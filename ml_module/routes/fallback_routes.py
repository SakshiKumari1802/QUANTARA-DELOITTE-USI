"""
OpenRouteService Fallback Client
Used when Google Maps API is unavailable
"""

import requests
from typing import List, Dict, Optional, Tuple, Any
from ..config.api_keys import get_openrouteservice_key
from ..utils.logger import get_logger

logger = get_logger(__name__)


class OpenRouteServiceClient:
    """
    Fallback client using OpenRouteService API
    """
    
    BASE_URL = "https://api.openrouteservice.org/v2"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenRouteService client.
        
        Args:
            api_key: OpenRouteService API key. If None, tries to load from environment.
        """
        self.api_key = api_key or get_openrouteservice_key()
        if not self.api_key:
            logger.warning("OpenRouteService API key not found. Fallback may not work.")
    
    def get_directions(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        alternatives: bool = True,
        profile: str = "driving-car"
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get directions between origin and destination.
        
        Args:
            origin: (longitude, latitude) of origin (note: lon, lat order for ORS)
            destination: (longitude, latitude) of destination
            alternatives: Whether to return alternative routes
            profile: Routing profile (driving-car, driving-hgv, cycling-regular, etc.)
        
        Returns:
            List of route dictionaries or None if failed
        """
        if not self.api_key:
            logger.error("Cannot get directions: OpenRouteService API key not configured")
            return None
        
        try:
            url = f"{self.BASE_URL}/directions/{profile}"
            headers = {
                "Authorization": self.api_key,
                "Content-Type": "application/json"
            }
            
            coords = [[origin[1], origin[0]], [destination[1], destination[0]]]  # ORS uses [lat, lon]
            
            params = {
                "coordinates": coords,
                "format": "geojson"
            }
            
            if alternatives:
                params["alternative_routes"] = {
                    "share_factor": 0.6,
                    "target_count": 3
                }
            
            logger.info(f"Requesting directions from {origin} to {destination} (fallback)")
            response = requests.post(url, json=params, headers=headers, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            routes = []
            for feature in data.get("features", []):
                route_data = self._parse_route(feature)
                routes.append(route_data)
            
            logger.info(f"Successfully retrieved {len(routes)} route(s) from OpenRouteService")
            return routes
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting directions (fallback): {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting directions (fallback): {str(e)}", exc_info=True)
            return None
    
    def _parse_route(self, feature: Dict) -> Dict[str, Any]:
        """
        Parse a route from OpenRouteService API response.
        
        Args:
            feature: Feature object from GeoJSON response
        
        Returns:
            Parsed route dictionary
        """
        properties = feature.get("properties", {})
        summary = properties.get("summary", {})
        geometry = feature.get("geometry", {})
        coordinates = geometry.get("coordinates", [])
        
        # Convert coordinates from [lon, lat] to [lat, lon] for consistency
        converted_coords = [[coord[1], coord[0]] for coord in coordinates]
        
        # Extract segments/steps if available
        segments = properties.get("segments", [])
        steps = []
        for segment in segments:
            for step in segment.get("steps", []):
                steps.append({
                    "distance_m": step.get("distance", 0),
                    "duration_s": step.get("duration", 0),
                    "instruction": step.get("instruction", ""),
                    "type": step.get("type", ""),
                    "way_points": step.get("way_points", [])
                })
        
        return {
            "distance_m": summary.get("distance", 0),
            "duration_s": summary.get("duration", 0),
            "distance_text": f"{summary.get('distance', 0) / 1000:.1f} km",
            "duration_text": f"{summary.get('duration', 0) / 60:.1f} mins",
            "start_address": "",
            "end_address": "",
            "steps": steps,
            "overview_polyline": "",  # ORS doesn't provide polyline in same format
            "coordinates": converted_coords,  # Store coordinates for visualization
            "bounds": self._calculate_bounds(converted_coords),
            "summary": f"Route via {summary.get('roads', ['unknown'])[0] if summary.get('roads') else 'unknown'}",
            "warnings": [],
            "waypoint_order": []
        }
    
    def _calculate_bounds(self, coordinates: List[List[float]]) -> Dict[str, Dict[str, float]]:
        """
        Calculate bounding box from coordinates.
        
        Args:
            coordinates: List of [lat, lon] coordinates
        
        Returns:
            Bounds dictionary
        """
        if not coordinates:
            return {"northeast": {"lat": 0, "lng": 0}, "southwest": {"lat": 0, "lng": 0}}
        
        lats = [coord[0] for coord in coordinates]
        lons = [coord[1] for coord in coordinates]
        
        return {
            "northeast": {"lat": max(lats), "lng": max(lons)},
            "southwest": {"lat": min(lats), "lng": min(lons)}
        }
    
    def is_available(self) -> bool:
        """
        Check if OpenRouteService API is available.
        
        Returns:
            True if API key is configured, False otherwise
        """
        return self.api_key is not None and len(self.api_key) > 0

