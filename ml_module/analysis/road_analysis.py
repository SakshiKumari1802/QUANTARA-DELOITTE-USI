"""
Road Analysis Module

Analyzes road quality, types, and widths along routes.
Combines road quality scores with weather risk assessment (weather data provided externally).
"""

from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
from ..utils.logger import get_logger

logger = get_logger("ml_module.analysis.road")


# Try to import OSMnx (optional dependency)
try:
    import osmnx as ox
    import networkx as nx
    OSMNX_AVAILABLE = True
    logger.info("OSMnx available for road type analysis")
except ImportError:
    OSMNX_AVAILABLE = False
    logger.warning("OSMnx not available - will use fallback road type estimation")


class RoadAnalyzer:
    """
    Analyzer for road quality, types, and weather conditions.
    
    Processes route segments to determine road characteristics and weather impact.
    """
    
    # Road width estimates (in meters) based on OSM highway types
    WIDTH_MAPPING = {
        'motorway': 12.0,
        'motorway_link': 10.0,
        'trunk': 11.0,
        'trunk_link': 9.0,
        'primary': 9.0,
        'primary_link': 7.0,
        'secondary': 7.0,
        'secondary_link': 6.0,
        'tertiary': 6.0,
        'tertiary_link': 5.0,
        'residential': 4.0,
        'service': 3.0,
        'unclassified': 4.0,
        'unknown': 5.0
    }
    
    # Road quality scores (0-100, higher is better)
    QUALITY_SCORES = {
        'motorway': 90,
        'trunk': 85,
        'primary': 80,
        'secondary': 70,
        'tertiary': 60,
        'residential': 50,
        'service': 40,
        'unclassified': 45,
        'unknown': 50
    }
    
    def __init__(self):
        """Initialize the Road Analyzer."""
        logger.info("RoadAnalyzer initialized")
        self.osmnx_available = OSMNX_AVAILABLE
        logger.info(f"OSMnx available (detected): {OSMNX_AVAILABLE}")
    
    def analyze(
        self,
        pre_extracted_segments: List[List],
        weather_results: Optional[List[Dict[str, Any]]] = None,
        osmnx_enabled: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        Analyze roads for multiple routes using pre-extracted segments.
        
        Args:
            pre_extracted_segments: List where each element is 
                [route_name, segments, max_length_m, min_length_m] for that route.
                Format: [[route_name1, segments_route1, max_length_m_route1, min_length_m_route1], ...]
            weather_results: Optional list of weather analysis results, one per route.
                If provided, weather data will be used in road quality calculation.
            osmnx_enabled: Optional override for OSMnx usage
        
        Returns:
            List of dictionaries with road analysis results
        """
        logger.info("="*60)
        logger.info("ROAD ANALYSIS STARTED")
        logger.info(f"Processing {len(pre_extracted_segments)} routes")
        
        # Allow caller to override whether OSMnx should be used
        if osmnx_enabled is not None:
            self.osmnx_available = bool(osmnx_enabled)
            logger.info(f"OSMnx usage overridden by caller: {self.osmnx_available}")
        
        if not pre_extracted_segments:
            logger.warning("No segments provided for road analysis")
            return []
        
        results = []
        
        for idx, segment_data in enumerate(pre_extracted_segments):
            route_name, segments, max_length_m, min_length_m = segment_data
            logger.info(f"Analyzing route: {route_name}")
            logger.debug(f"Using pre-extracted segments (max_length={max_length_m:.2f}m, "
                       f"min_length={min_length_m:.2f}m)")
            
            if not segments:
                logger.warning(f"No segments extracted for route {route_name}")
                # Return default values (distance_m will be 0 since no segments)
                results.append(self._create_default_result(route_name, 0.0))
                continue
            
            # Get road types for segments
            segments_with_roads = self._analyze_road_types(segments)
            
            # Get weather data for this route (if provided)
            weather_data = None
            if weather_results and idx < len(weather_results):
                weather_data = weather_results[idx]
                logger.debug(f"Using weather data for route {route_name}")
            
            # Calculate road quality (with weather impact if available)
            analysis = self._calculate_road_quality(segments_with_roads, weather_data)
            analysis["route_name"] = route_name
            
            results.append(analysis)
            
            logger.info(f"Route '{route_name}': road_quality_score={analysis['road_quality_score']:.4f}, "
                       f"avg_weather_risk={analysis['avg_weather_risk']:.4f}")
        
        logger.info("ROAD ANALYSIS COMPLETE")
        logger.info("="*60)
        
        return results
    
    def analyze_segment(self, 
                       mid_point: Tuple[float, float], 
                       length_m: float, 
                       osmnx_enabled: bool = False) -> Dict[str, Any]:
        """
        Analyze a single segment based on valid parameters.
        
        Args:
            mid_point: (lat, lon) tuple
            length_m: Length in meters
            osmnx_enabled: Whether to use OSMnx
            
        Returns:
            Dictionary with road type, width, base quality
        """
        # 1. Determine road type
        if osmnx_enabled and self.osmnx_available:
            road_type = self._get_osmnx_road_type_at_point(mid_point)
        else:
            road_type = self._estimate_road_type(length_m)
            
        # 2. Get properties
        road_width = self.WIDTH_MAPPING.get(road_type, 5.0)
        base_quality = self.QUALITY_SCORES.get(road_type, 50)

        logger.debug(f"Road at ({mid_point[0]:.4f}, {mid_point[1]:.4f}): road_type={road_type}, road_width={road_width:.2f}m, base_quality={base_quality}")
        
        return {
            "road_type": road_type,
            "road_width": road_width,
            "base_quality": base_quality
        }

    def _get_osmnx_road_type_at_point(self, point: Tuple[float, float]) -> str:
        """
        Get road type at a specific point using OSMnx.
        """
        try:
            lat, lon = point
            G = ox.graph_from_point((lat, lon), dist=500, network_type='drive')
            node = ox.nearest_nodes(G, lon, lat)
            
            # Check edges connected to this node
            for neighbor in G.neighbors(node):
                edge_data = G[node][neighbor][0]
                highway = edge_data.get('highway', 'unknown')
                if isinstance(highway, list):
                    highway = highway[0]
                return str(highway)
                
            return 'secondary'
        except Exception:
            return 'secondary'

    def _estimate_road_type(self, length_m: float) -> str:
        """Estimate road type based on segment length."""
        if length_m > 10000: return 'motorway'
        elif length_m > 5000: return 'primary'
        elif length_m > 2000: return 'secondary'
        else: return 'tertiary'

