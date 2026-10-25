"""
OSRM Client Module

Fallback routing client using OSRM (Open Source Routing Machine).
Provides compatible interface with Google Maps client.
"""

from typing import List, Dict, Any, Optional, Tuple
import requests
from ..utils.logger import get_logger

logger = get_logger("ml_module.routes.osrm")


class OSRMClient:
    """
    Client for OSRM routing API.
    
    Provides route alternatives as fallback when Google Maps is unavailable.
    """
    
    # Public OSRM server (can be replaced with self-hosted instance)
    BASE_URL = "http://router.project-osrm.org"
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize OSRM client.
        
        Args:
            base_url: Optional custom OSRM server URL
        """
        self.base_url = base_url or self.BASE_URL
        logger.info(f"OSRMClient initialized with base URL: {self.base_url}")
    
    def is_available(self) -> bool:
        """
        Check if OSRM service is available.
        
        Returns:
            True if service is reachable, False otherwise
        """
        try:
            response = requests.get(f"{self.base_url}/nearest/v1/driving/0,0", timeout=5)
            return response.status_code in [200, 400]  # 400 is okay, means service is up
        except Exception as e:
            logger.warning(f"OSRM service unavailable: {str(e)}")
            return False
    
    def get_directions(self,
                      origin: Tuple[float, float],
                      destination: Tuple[float, float],
                      alternatives: bool = True) -> Optional[List[Dict[str, Any]]]:
        """
        Get driving directions from origin to destination.
        
        Args:
            origin: (latitude, longitude) tuple
            destination: (latitude, longitude) tuple
            alternatives: Whether to request alternative routes
        
        Returns:
            List of route dictionaries (compatible with Google Maps format), or None if failed
        """
        logger.info(f"Requesting OSRM directions: {origin} -> {destination}")
        
        try:
            # OSRM expects lon,lat format
            origin_str = f"{origin[1]},{origin[0]}"
            dest_str = f"{destination[1]},{destination[0]}"
            
            # Build URL
            url = f"{self.base_url}/route/v1/driving/{origin_str};{dest_str}"
            
            params = {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
                "alternatives": "true" if alternatives else "false"
            }
            
            logger.debug(f"OSRM request URL: {url}")
            logger.debug(f"OSRM params: {params}")
            
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("code") != "Ok":
                logger.error(f"OSRM error: {data.get('code')} - {data.get('message', 'Unknown error')}")
                return None
            
            routes = []
            for route_data in data.get("routes", []):
                parsed_route = self._parse_route(route_data)
                routes.append(parsed_route)
            
            logger.info(f"Successfully retrieved {len(routes)} route(s) from OSRM")
            return routes
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting OSRM directions: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting OSRM directions: {str(e)}", exc_info=True)
            return None
    
    def _parse_route(self, route: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse OSRM route to Google Maps-compatible format.
        
        Args:
            route: Route object from OSRM API response
        
        Returns:
            Parsed route dictionary compatible with Google Maps format
        """
        # Extract distance and duration
        distance_m = route.get("distance", 0)
        duration_s = route.get("duration", 0)
        
        # Extract geometry (coordinates)
        geometry = route.get("geometry", {})
        coordinates = geometry.get("coordinates", [])
        
        # Convert from [lon, lat] to [lat, lon]
        converted_coords = [[coord[1], coord[0]] for coord in coordinates]
        
        # Extract steps from legs
        steps = []
        legs = route.get("legs", [])
        
        for leg in legs:
            for step in leg.get("steps", []):
                step_distance = step.get("distance", 0)
                step_duration = step.get("duration", 0)
                maneuver = step.get("maneuver", {})
                
                # Get start and end locations
                step_geometry = step.get("geometry", {})
                step_coords = step_geometry.get("coordinates", [])
                
                if step_coords:
                    start_coord = step_coords[0]
                    end_coord = step_coords[-1]
                    
                    parsed_step = {
                        "distance_m": step_distance,
                        "duration_s": step_duration,
                        "instruction": maneuver.get("instruction", ""),
                        "start_location": {
                            "lat": start_coord[1],
                            "lng": start_coord[0]
                        },
                        "end_location": {
                            "lat": end_coord[1],
                            "lng": end_coord[0]
                        },
                        "polyline": "",  # OSRM doesn't provide encoded polylines by default
                        "maneuver": maneuver.get("type", "")
                    }
                    steps.append(parsed_step)
        
        # Format text representations
        distance_km = distance_m / 1000
        distance_text = f"{distance_km:.1f} km"
        
        duration_min = duration_s / 60
        if duration_min < 60:
            duration_text = f"{int(duration_min)} mins"
        else:
            hours = int(duration_min / 60)
            mins = int(duration_min % 60)
            duration_text = f"{hours} hrs {mins} mins" if mins > 0 else f"{hours} hrs"
        
        parsed = {
            "distance_m": distance_m,
            "duration_s": duration_s,
            "distance_text": distance_text,
            "duration_text": duration_text,
            "start_address": "",  # OSRM doesn't provide addresses
            "end_address": "",
            "steps": steps,
            "overview_polyline": "",  # OSRM uses GeoJSON, not encoded polylines
            "coordinates": converted_coords,  # Store for later use
            "bounds": self._calculate_bounds(converted_coords),
            "summary": f"OSRM Route ({distance_text}, {duration_text})",
            "warnings": [],
            "waypoint_order": []
        }
        
        logger.debug(f"Parsed OSRM route: {distance_text}, {duration_text}, {len(steps)} steps")
        
        return parsed
    
    def _calculate_bounds(self, coordinates: List[List[float]]) -> Dict[str, Dict[str, float]]:
        """
        Calculate bounding box for coordinates.
        
        Args:
            coordinates: List of [lat, lon] pairs
        
        Returns:
            Dictionary with northeast and southwest bounds
        """
        if not coordinates:
            return {
                "northeast": {"lat": 0, "lng": 0},
                "southwest": {"lat": 0, "lng": 0}
            }
        
        lats = [coord[0] for coord in coordinates]
        lons = [coord[1] for coord in coordinates]
        
        return {
            "northeast": {
                "lat": max(lats),
                "lng": max(lons)
            },
            "southwest": {
                "lat": min(lats),
                "lng": min(lons)
            }
        }

