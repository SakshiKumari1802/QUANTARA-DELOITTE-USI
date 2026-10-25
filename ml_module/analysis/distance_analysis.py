"""
Distance Analysis Module

Calculates distance scores for routes based on normalized length.
Formula: distance_score = 1 - ((dist_route - dist_min) / (dist_max - dist_min))
"""

from typing import List, Dict, Any
from ..utils.logger import get_logger

logger = get_logger("ml_module.analysis.distance")


class DistanceAnalyzer:
    """
    Analyzer for route distance scoring.
    
    Calculates normalized distance scores where shorter routes get higher scores.
    """
    
    def __init__(self):
        """Initialize the Distance Analyzer."""
        logger.info("DistanceAnalyzer initialized")
    
    def analyze(self, routes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze route distances and calculate distance scores.
        
        Args:
            routes: List of route dictionaries, each containing:
                - route_name: Name/identifier of the route
                - distance_m: Distance in meters
                - distance_text: Human-readable distance (optional)
        
        Returns:
            List of dictionaries with distance analysis results:
                - route_name: Route identifier
                - distance_m: Distance in meters
                - distance_km: Distance in kilometers
                - distance_text: Formatted distance string
                - distance_score: Normalized score (0-1, higher is better)
        """
        logger.info("="*60)
        logger.info("DISTANCE ANALYSIS STARTED")
        logger.info(f"Processing {len(routes)} routes")
        
        if not routes:
            logger.warning("No routes provided for distance analysis")
            return []
        
        # Extract distances
        distances = []
        for route in routes:
            distance_m = route.get("distance_m", 0)
            distances.append(distance_m)
            logger.debug(f"Route '{route.get('route_name', 'Unknown')}': distance={distance_m}m "
                        f"({distance_m/1000:.2f}km)")
        
        # Find min and max distances
        dist_min = min(distances)
        dist_max = max(distances)
        
        logger.info(f"Distance range: min={dist_min}m ({dist_min/1000:.2f}km), "
                   f"max={dist_max}m ({dist_max/1000:.2f}km)")
        
        # Calculate distance scores
        results = []
        for route in routes:
            route_name = route.get("route_name", "Unknown")
            distance_m = route.get("distance_m", 0)
            distance_km = distance_m / 1000
            
            # Calculate normalized score (avoid division by zero)
            if dist_max == dist_min:
                distance_score = 1.0  # All routes have same distance
                logger.debug(f"All routes have equal distance, assigning score=1.0")
            else:
                distance_score = 1.0 - ((distance_m - dist_min) / (dist_max - dist_min))
            
            # Ensure score is in valid range [0, 1]
            distance_score = max(0.0, min(1.0, distance_score))
            
            result = {
                "route_name": route_name,
                "distance_m": distance_m,
                "distance_km": distance_km,
                "distance_text": self._format_distance(distance_m),
                "distance_score": distance_score
            }
            
            results.append(result)
            
            logger.info(f"Route '{route_name}': distance={distance_m}m ({distance_km:.2f}km), "
                       f"score={distance_score:.4f}")
        
        logger.info("DISTANCE ANALYSIS COMPLETE")
        logger.info("="*60)
        
        return results
    
    def _format_distance(self, distance_m: float) -> str:
        """
        Format distance in meters to human-readable string.
        
        Args:
            distance_m: Distance in meters
        
        Returns:
            Formatted string (e.g., "123.4 km", "850 m")
        """
        if distance_m < 1000:
            return f"{int(distance_m)} m"
        else:
            distance_km = distance_m / 1000
            return f"{distance_km:.1f} km"

