"""
Carbon Emission Analysis Module

Calculates carbon emission scores for routes based on distance and emission factors.
Formula: carbon_per_route = sum(segment_length_km * EMISSION_FACTOR * LOAD_FACTOR * FUEL_CORRECTION)
         carbon_score = 1 - ((carbon_route - carbon_min) / (carbon_max - carbon_min))
"""

from typing import List, Dict, Any
from ..utils.logger import get_logger

logger = get_logger("ml_module.analysis.carbon")


class CarbonAnalyzer:
    """
    Analyzer for route carbon emission scoring.
    
    Calculates carbon emissions based on distance and emission factors,
    then provides normalized scores where lower emissions get higher scores.
    """
    
    # Emission constants (kg CO2 per km)
    EMISSION_FACTOR = 0.8  # Typical diesel truck
    LOAD_FACTOR = 1.2      # Loaded vs empty
    FUEL_CORRECTION = 1.0  # Fuel quality adjustment
    
    def __init__(self):
        """Initialize the Carbon Analyzer."""
        logger.info("CarbonAnalyzer initialized")
        logger.info(f"Emission parameters: EF={self.EMISSION_FACTOR} kg/km, "
                   f"LF={self.LOAD_FACTOR}, FC={self.FUEL_CORRECTION}")
    
    def analyze(self, routes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze route carbon emissions and calculate carbon scores.
        
        Args:
            routes: List of route dictionaries, each containing:
                - route_name: Name/identifier of the route
                - distance_m: Distance in meters
                OR
                - road_segments: List of segments with length_m (if available)
        
        Returns:
            List of dictionaries with carbon analysis results:
                - route_name: Route identifier
                - total_carbon_kg: Total carbon emissions in kg
                - carbon_score: Normalized score (0-1, higher is better/lower emissions)
                - carbon_per_km: Emissions per kilometer
        """
        logger.info("="*60)
        logger.info("CARBON EMISSION ANALYSIS STARTED")
        logger.info(f"Processing {len(routes)} routes")
        
        if not routes:
            logger.warning("No routes provided for carbon analysis")
            return []
        
        # Calculate carbon emissions for each route
        carbon_emissions = []
        for route in routes:
            route_name = route.get("route_name", "Unknown")
            
            # Get total distance (prefer road_segments if available for accuracy)
            if "road_segments" in route and route["road_segments"]:
                # Sum up segment lengths
                total_distance_m = sum(
                    seg.get("length_m", 0) for seg in route["road_segments"]
                )
                logger.debug(f"Route '{route_name}': Using {len(route['road_segments'])} "
                           f"segments, total distance={total_distance_m}m")
            else:
                # Fallback to route-level distance
                total_distance_m = route.get("distance_m", 0)
                logger.debug(f"Route '{route_name}': Using route distance={total_distance_m}m")
            
            total_distance_km = total_distance_m / 1000
            
            # Calculate carbon emission
            carbon_kg = self._calculate_carbon_emission(total_distance_km)
            carbon_emissions.append(carbon_kg)
            
            logger.debug(f"Route '{route_name}': distance={total_distance_km:.2f}km, "
                        f"carbon={carbon_kg:.2f}kg CO2")
        
        # Find min and max emissions
        carbon_min = min(carbon_emissions)
        carbon_max = max(carbon_emissions)
        
        logger.info(f"Carbon emission range: min={carbon_min:.2f}kg, max={carbon_max:.2f}kg")
        
        # Calculate carbon scores
        results = []
        for route, carbon_kg in zip(routes, carbon_emissions):
            route_name = route.get("route_name", "Unknown")
            
            # Get distance for per-km calculation
            if "road_segments" in route and route["road_segments"]:
                total_distance_m = sum(seg.get("length_m", 0) for seg in route["road_segments"])
            else:
                total_distance_m = route.get("distance_m", 0)
            
            total_distance_km = total_distance_m / 1000
            
            # Calculate carbon per km
            carbon_per_km = carbon_kg / total_distance_km if total_distance_km > 0 else 0
            
            # Calculate normalized score (avoid division by zero)
            if carbon_max == carbon_min:
                carbon_score = 1.0  # All routes have same emissions
                logger.debug(f"All routes have equal emissions, assigning score=1.0")
            else:
                carbon_score = 1.0 - ((carbon_kg - carbon_min) / (carbon_max - carbon_min))
            
            # Ensure score is in valid range [0, 1]
            carbon_score = max(0.0, min(1.0, carbon_score))
            
            result = {
                "route_name": route_name,
                "total_carbon_kg": carbon_kg,
                "carbon_score": carbon_score,
                "carbon_per_km": carbon_per_km
            }
            
            results.append(result)
            
            logger.info(f"Route '{route_name}': carbon={carbon_kg:.2f}kg CO2 "
                       f"({carbon_per_km:.3f}kg/km), score={carbon_score:.4f}")
        
        logger.info("CARBON EMISSION ANALYSIS COMPLETE")
        logger.info("="*60)
        
        return results
    
    def _calculate_carbon_emission(self, distance_km: float) -> float:
        """
        Calculate carbon emission for a given distance.
        
        Args:
            distance_km: Distance in kilometers
        
        Returns:
            Carbon emission in kg CO2
        """
        emission = (
            distance_km * 
            self.EMISSION_FACTOR * 
            self.LOAD_FACTOR * 
            self.FUEL_CORRECTION
        )
        
        return emission

