"""
Route Segmentation Utilities

Provides reusable helpers for splitting routes into segments and
computing distances between coordinate pairs.
"""

from typing import List, Dict, Any, Tuple
import math

from ..utils.logger import get_logger

logger = get_logger("ml_module.analysis.segmentation")


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula.

    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate

    Returns:
        Distance in meters
    """
    R = 6371000  # Earth radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2) ** 2)

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance


def extract_segments(route: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], float, float]:
    """
    Extract road segments from Google Maps route steps.

    Args:
        route: Route dictionary with 'steps'

    Returns:
        List of segments with start/end coordinates and lengths
    """
    steps = route.get("steps", [])
    if not steps:
        logger.warning("No steps found in route")
        return [], 0.0, 0.0

    segments: List[Dict[str, Any]] = []
    segment_id = 0
    max_length_m = 0.0
    min_length_m = float('inf')

    for step in steps:
        start_loc = step.get("start_location", {})
        end_loc = step.get("end_location", {})

        if not start_loc or not end_loc:
            continue

        start_lat = start_loc.get("lat", 0)
        start_lon = start_loc.get("lng", 0)
        end_lat = end_loc.get("lat", 0)
        end_lon = end_loc.get("lng", 0)

        if start_lat == 0 or start_lon == 0 or end_lat == 0 or end_lon == 0:
            continue

        # Calculate segment length using haversine formula
        length_m = haversine_distance(start_lat, start_lon, end_lat, end_lon)

        # Calculate mid-point
        mid_lat = (start_lat + end_lat) / 2
        mid_lon = (start_lon + end_lon) / 2

        segment = {
            "segment_id": segment_id,
            "start": (start_lat, start_lon),
            "end": (end_lat, end_lon),
            "mid": (mid_lat, mid_lon),
            "length_m": length_m,
        }

        max_length_m = max(max_length_m, length_m)
        min_length_m = min(min_length_m, length_m)

        segments.append(segment)
        segment_id += 1

    # Handle case when no segments were found
    if not segments:
        max_length_m = 0.0
        min_length_m = 0.0
    elif min_length_m == float('inf'):
        # Safety fallback (shouldn't happen if segments exist)
        min_length_m = max_length_m

    logger.debug(
        f"Extracted {len(segments)} segments from {len(steps)} steps "
        f"(min_length={min_length_m:.2f}m, max_length={max_length_m:.2f}m)"
    )
    return segments, max_length_m, min_length_m


def extract_segments_for_routes(routes: List[Dict[str, Any]]) -> List[List]:
    """
    Extract segments for multiple routes.
    
    Args:
        routes: List of route dictionaries, each containing 'steps'
    
    Returns:
        List where each element is [route_name, segments, max_length_m, min_length_m] for that route
        Format: [[route_name1, segments_route1, max_length_m_route1, min_length_m_route1], 
                 [route_name2, segments_route2, max_length_m_route2, min_length_m_route2], ...]
    """
    results = []
    
    for route in routes:
        route_name = route.get("route_name", "Unknown")
        logger.info(f"Extracting segments for route: {route_name}")
        segments, max_length_m, min_length_m = extract_segments(route)
        results.append([route_name, segments, max_length_m, min_length_m])
        logger.info(f"Extracted {len(segments)} segments for route: {route_name}")
    
    logger.info(f"Extracted segments for {len(routes)} routes")
    return results


