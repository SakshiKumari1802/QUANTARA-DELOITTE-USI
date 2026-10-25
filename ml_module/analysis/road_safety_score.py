"""
Road Safety Score Analysis Module

Calculates a comprehensive road safety score combining:
1. Road Condition/Quality (from RoadAnalyzer)
2. Weather Risk at specific segments (from WeatherAnalyzer)

Formula:
road_safety_score = sum((road_quality_score[j] - weather_risk_score[j])*road_length[j])/100*total_road_length
"""

from typing import List, Dict, Any, Optional
from ..utils.logger import get_logger
from .weather_analysis import WeatherAnalyzer
from .road_analysis import RoadAnalyzer

logger = get_logger("ml_module.analysis.road_safety")


class RoadSafetyScorer:
    """
    Scorer for road safety based on road quality and weather conditions.
    """
    
    def __init__(self):
        """Initialize the Road Safety Scorer."""
        logger.info("RoadSafetyScorer initialized")
        self.weather_analyzer = WeatherAnalyzer()
        self.road_analyzer = RoadAnalyzer()
        
    def calculate(self, 
                 segment_data: List[Any], 
                 osmnx_enabled: Optional[bool] = None) -> Dict[str, Any]:
        """
        Perform full safety analysis including weather, road, and scoring.
        
        Args:
            segment_data: Tuple/List of [route_name, segments, max_length_m, min_length_m]
            osmnx_enabled: Whether to use OSMnx
            
        Returns:
            Dictionary containing:
            - road_safety_score: float
            - weather_analysis: Dict
            - road_analysis: Dict
        """
        route_name, segments, max_len, min_len = segment_data
        
        logger.info(f"Starting safety analysis for {route_name}")
        
        if not segments:
            logger.warning(f"No segments for {route_name}")
            return default_result()

        # Lists to collect granular results
        segment_results = []
        weather_data_list = []
        
        weighted_sum = 0.0
        total_length = 0.0
        
        # Track aggregates for final summary
        total_rainfall = 0.0
        total_wind = 0.0
        total_vis = 0.0
        total_temp = 0.0
        total_cloud = 0.0
        total_weather_risk = 0.0
        
        road_type_dist = {}
        weighted_road_quality = 0.0
        
        for i, segment in enumerate(segments):
            length = segment.get("length_m", 0)
            mid_point = segment.get("mid")
            
            if not mid_point:
                start = segment.get("start")
                end = segment.get("end")
                if start and end:
                    mid_point = ((start[0] + end[0])/2, (start[1] + end[1])/2)
                else:
                    mid_point = (0.0, 0.0)
            
            # 1. Get Road Score for this segment
            # Returns {road_type, road_width, base_quality}
            r_data = self.road_analyzer.analyze_segment(mid_point, length, osmnx_enabled)
            
            # 2. Get Weather Data for this segment
            # Returns {weather_risk_score, rainfall_mm, ...}
            if i % 10 == 0:
                w_data = self.weather_analyzer.get_weather_at_point(mid_point[0], mid_point[1])
                w_data["sample_id"] = i
                w_data["location"] = mid_point
            
            # --- Scoring Logic ---
            base_quality = r_data["base_quality"]
            weather_risk = w_data["weather_risk_score"]
            
            # road_safety_score += (road_score - weather_data["weather_risk"]) * length
            # Normalize risk to 0-100 to match quality scale
            term = (base_quality - (weather_risk * 100)) * length
            weighted_sum += term
            
            total_length += length
            
            # --- Aggregation for Report ---
            # Enrich segment with metadata
            segment.update(r_data)
            segment["weather"] = {
                "rainfall_mm": w_data["rainfall_mm"],
                "visibility_m": w_data["visibility_m"],
                "windspeed": w_data["windspeed"],
                "temperature": w_data["temperature"],
                "cloudcover": w_data["cloudcover"]
            }
            segment_results.append(segment)
            weather_data_list.append(w_data)
            
            # Weather aggregates
            total_rainfall += w_data["rainfall_mm"]
            total_wind += w_data["windspeed"]
            total_vis += w_data["visibility_m"]
            total_temp += w_data["temperature"]
            total_cloud += w_data["cloudcover"]
            total_weather_risk += weather_risk
            
            # Road aggregates
            rt = r_data["road_type"]
            road_type_dist[rt] = road_type_dist.get(rt, 0) + (length / 1000)
            
            # Calculate quality score contribution for road_analysis report
            # adjusted_quality = base_quality - (weather_risk * 100) -> max(0, ..)
            adj_q = max(0, base_quality - (weather_risk * 100))
            weighted_road_quality += adj_q * length

        # --- Final Calculation ---
        
        # Safety Score
        final_score = 0.0
        if total_length > 0:
            final_score = weighted_sum / (100 * total_length)
        final_score = max(0.0, min(1.0, final_score))
        
        count = len(segments)
        # Construct composite Weather Analysis Result
        weather_analysis = {
            "weather_data": weather_data_list,
            "avg_rainfall": total_rainfall / count if count else 0,
            "avg_windspeed": total_wind / count if count else 0,
            "avg_visibility": total_vis / count if count else 10000,
            "avg_temperature": total_temp / count if count else 20,
            "avg_cloudcover": int(total_cloud / count) if count else 30,
            "avg_weather_risk": total_weather_risk / count if count else 0,
            # Risks (simplified average)
            "visibility_risk": sum(w["visibility_risk"] for w in weather_data_list)/count if count else 0,
            "rain_risk": sum(w["rain_risk"] for w in weather_data_list)/count if count else 0,
            "wind_risk": sum(w["wind_risk"] for w in weather_data_list)/count if count else 0,
        }
        
        # Construct composite Road Analysis Result
        road_quality_score = (weighted_road_quality / total_length) / 100 if total_length > 0 else 0.5
        road_quality_score = max(0.0, min(1.0, road_quality_score))
        
        road_analysis = {
            "road_segments": segment_results,
            "road_quality_score": road_quality_score,
            "avg_weather_risk": weather_analysis["avg_weather_risk"],
            "total_rainfall": weather_analysis["avg_rainfall"],
            "road_type_distribution": road_type_dist
        }
        
        logger.info(f"Route '{route_name}': Safety Score = {final_score:.4f}, Weather Risk = {weather_analysis['avg_weather_risk']:.4f}")
        
        return {
            "road_safety_score": final_score,
            "weather_analysis": weather_analysis,
            "road_analysis": road_analysis
        }

def default_result():
    return {
        "road_safety_score": 0.5,
        "weather_analysis": {},
        "road_analysis": {}
    }