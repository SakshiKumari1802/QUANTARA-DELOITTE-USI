"""
Google Maps API Client
Handles Directions, Places, and Roads APIs with comprehensive error handling
"""

import requests
from typing import List, Dict, Optional, Tuple, Any
from ..config.api_keys import get_google_maps_key
from ..utils.logger import get_logger

logger = get_logger(__name__)


class GoogleMapsClient:
    """
    Client for Google Maps APIs (Directions, Places, Roads)
    """
    
    BASE_URL = "https://maps.googleapis.com/maps/api"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Google Maps client.
        
        Args:
            api_key: Google Maps API key. If None, tries to load from environment.
        """
        self.api_key = api_key or get_google_maps_key()
        if not self.api_key:
            logger.warning("Google Maps API key not found. API calls will fail.")
    
    def get_directions(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        alternatives: bool = True,
        waypoints: Optional[List[Tuple[float, float]]] = None,
        mode: str = "driving"
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get directions between origin and destination.
        
        Args:
            origin: (latitude, longitude) of origin
            destination: (latitude, longitude) of destination
            alternatives: Whether to return alternative routes
            waypoints: Optional list of waypoints
            mode: Travel mode (driving, walking, bicycling, transit)
        
        Returns:
            List of route dictionaries with distance, duration, steps, etc.
            Returns None if API call fails
        """
        if not self.api_key:
            logger.error("Cannot get directions: API key not configured")
            return None
        
        try:
            url = f"{self.BASE_URL}/directions/json"
            params = {
                "origin": f"{origin[0]},{origin[1]}",
                "destination": f"{destination[0]},{destination[1]}",
                "key": self.api_key,
                "alternatives": str(alternatives).lower(),
                "mode": mode
            }
            
            if waypoints:
                waypoint_str = "|".join([f"{wp[0]},{wp[1]}" for wp in waypoints])
                params["waypoints"] = waypoint_str
            
            logger.info(f"Requesting directions from {origin} to {destination}")
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") != "OK":
                logger.error(f"Google Maps Directions API error: {data.get('status')} - {data.get('error_message', 'Unknown error')}")
                return None
            
            routes = []
            for i,route in enumerate (data.get("routes", [])):
                route_data = self._parse_route(route, data.get("geocoded_waypoints", []))
                logger.debug(f"Route {i}: {route_data}")
                routes.append(route_data)
            
            logger.info(f"Successfully retrieved {len(routes)} route(s)")
            return routes
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting directions: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting directions: {str(e)}", exc_info=True)
            return None
    
    def _parse_route(self, route: Dict, geocoded_waypoints: List) -> Dict[str, Any]:
        """
        Parse a route from Google Maps API response.
        
        Args:
            route: Route object from API response
            geocoded_waypoints: Geocoded waypoints information
        
        Returns:
            Parsed route dictionary
        """
        leg = route["legs"][0] if route.get("legs") else {}
        
        # Extract steps with turns and instructions
        steps = []
        for step in leg.get("steps", []):
            steps.append({
                "distance_m": step.get("distance", {}).get("value", 0),
                "duration_s": step.get("duration", {}).get("value", 0),
                "instruction": step.get("html_instructions", ""),
                "start_location": step.get("start_location", {}),
                "end_location": step.get("end_location", {}),
                "polyline": step.get("polyline", {}).get("points", ""),
                "maneuver": step.get("maneuver", "")
            })
        
        # Extract overview polyline
        overview_polyline = route.get("overview_polyline", {}).get("points", "")
        
        return {
            "distance_m": leg.get("distance", {}).get("value", 0),
            "duration_s": leg.get("duration", {}).get("value", 0),
            "distance_text": leg.get("distance", {}).get("text", ""),
            "duration_text": leg.get("duration", {}).get("text", ""),
            "start_address": leg.get("start_address", ""),
            "end_address": leg.get("end_address", ""),
            "steps": steps,
            "overview_polyline": overview_polyline,
            "coordinates": self._decode_polyline(overview_polyline),
            "bounds": route.get("bounds", {}),
            "summary": route.get("summary", ""),
            "warnings": route.get("warnings", []),
            "waypoint_order": route.get("waypoint_order", [])
        }

    def _decode_polyline(self, polyline_str: str) -> List[List[float]]:
        """
        Decodes a Google Maps encoded polyline string into a list of [lat, lng] pairs.
        """
        index, lat, lng = 0, 0, 0
        coordinates = []
        changes = {'latitude': 0, 'longitude': 0}

        while index < len(polyline_str):
            for unit in ['latitude', 'longitude']:
                shift, result = 0, 0

                while True:
                    byte = ord(polyline_str[index]) - 63
                    index += 1
                    result |= (byte & 0x1f) << shift
                    shift += 5
                    if not byte >= 0x20:
                        break

                if (result & 1):
                    changes[unit] = ~(result >> 1)
                else:
                    changes[unit] = (result >> 1)

            lat += changes['latitude']
            lng += changes['longitude']

            coordinates.append([lat / 100000.0, lng / 100000.0])

        return coordinates
    
    def get_place_details(self, place_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a place using Places API.
        
        Args:
            place_id: Google Place ID
        
        Returns:
            Place details dictionary or None if failed
        """
        if not self.api_key:
            logger.error("Cannot get place details: API key not configured")
            return None
        
        try:
            url = f"{self.BASE_URL}/place/details/json"
            params = {
                "place_id": place_id,
                "key": self.api_key,
                "fields": "name,formatted_address,geometry,rating,types,opening_hours"
            }
            
            logger.debug(f"Requesting place details for place_id: {place_id}")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") != "OK":
                logger.warning(f"Places API error: {data.get('status')}")
                return None
            
            return data.get("result", {})
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting place details: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting place details: {str(e)}", exc_info=True)
            return None
    
    def snap_to_roads(self, path: List[Tuple[float, float]]) -> Optional[List[Dict[str, Any]]]:
        """
        Snap a path to roads using Roads API.
        
        Args:
            path: List of (latitude, longitude) points
        
        Returns:
            List of snapped points with road information or None if failed
        """
        if not self.api_key:
            logger.error("Cannot snap to roads: API key not configured")
            return None
        
        try:
            url = f"{self.BASE_URL}/roads/snapToRoads"
            path_str = "|".join([f"{p[0]},{p[1]}" for p in path])
            params = {
                "path": path_str,
                "key": self.api_key,
                "interpolate": "true"
            }
            
            logger.debug(f"Snapping {len(path)} points to roads")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") != "OK":
                logger.warning(f"Roads API error: {data.get('status')}")
                return None
            
            return data.get("snappedPoints", [])
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error snapping to roads: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error snapping to roads: {str(e)}", exc_info=True)
            return None
    
    def get_speed_limits(self, place_ids: List[str]) -> Optional[List[Dict[str, Any]]]:
        """
        Get speed limits for places using Roads API.
        
        Args:
            place_ids: List of place IDs (from snap_to_roads)
        
        Returns:
            List of speed limit information or None if failed
        """
        if not self.api_key:
            logger.error("Cannot get speed limits: API key not configured")
            return None
        
        if not place_ids:
            return []
        
        try:
            url = f"{self.BASE_URL}/roads/speedLimits"
            place_ids_str = "|".join(place_ids)
            params = {
                "placeIds": place_ids_str,
                "key": self.api_key
            }
            
            logger.debug(f"Getting speed limits for {len(place_ids)} places")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("status") != "OK":
                logger.warning(f"Roads API speed limits error: {data.get('status')}")
                return None
            
            return data.get("speedLimits", [])
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting speed limits: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting speed limits: {str(e)}", exc_info=True)
            return None
    
    def is_available(self) -> bool:
        """
        Check if Google Maps API is available (has valid API key).
        
        Returns:
            True if API key is configured, False otherwise
        """
        return self.api_key is not None and len(self.api_key) > 0

