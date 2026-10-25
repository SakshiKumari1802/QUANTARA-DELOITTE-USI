"""
Time Analysis Module

Calculates time scores for routes based on normalized duration.
Formula: time_score = 1 - ((time_route - time_min) / (time_max - time_min))
"""

from typing import List, Dict, Any
from ..utils.logger import get_logger

logger = get_logger("ml_module.analysis.time")


class TimeAnalyzer:
    """
    Analyzer for route time/duration scoring.
    
    Calculates normalized time scores where lower duration routes get higher scores.
    """
    
    def __init__(self):
        """Initialize the Time Analyzer."""
        logger.info("TimeAnalyzer initialized")
    
    def analyze(self, routes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyze route durations and calculate time scores.
        
        Args:
            routes: List of route dictionaries, each containing:
                - route_name: Name/identifier of the route
                - duration_s: Duration in seconds
                - duration_text: Human-readable duration (optional)
        
        Returns:
            List of dictionaries with time analysis results:
                - route_name: Route identifier
                - duration_s: Duration in seconds
                - duration_text: Formatted duration string
                - time_score: Normalized score (0-1, higher is better)
        """
        logger.info("="*60)
        logger.info("TIME ANALYSIS STARTED")
        logger.info(f"Processing {len(routes)} routes")
        
        if not routes:
            logger.warning("No routes provided for time analysis")
            return []
        
        # Extract durations
        durations = []
        for route in routes:
            duration_s = route.get("duration_s", 0)
            durations.append(duration_s)
            logger.debug(f"Route '{route.get('route_name', 'Unknown')}': duration={duration_s}s")
        
        # Find min and max durations
        time_min = min(durations)
        time_max = max(durations)
        
        logger.info(f"Duration range: min={time_min}s ({self._format_duration(time_min)}), "
                   f"max={time_max}s ({self._format_duration(time_max)})")
        
        # Calculate time scores
        results = []
        for route in routes:
            route_name = route.get("route_name", "Unknown")
            duration_s = route.get("duration_s", 0)
            
            # Calculate normalized score (avoid division by zero)
            if time_max == time_min:
                time_score = 1.0  # All routes have same duration
                logger.debug(f"All routes have equal duration, assigning score=1.0")
            else:
                time_score = 1.0 - ((duration_s - time_min) / (time_max - time_min))
            
            # Ensure score is in valid range [0, 1]
            time_score = max(0.0, min(1.0, time_score))
            
            result = {
                "route_name": route_name,
                "duration_s": duration_s,
                "duration_text": self._format_duration(duration_s),
                "time_score": time_score
            }
            
            results.append(result)
            
            logger.info(f"Route '{route_name}': duration={duration_s}s "
                       f"({self._format_duration(duration_s)}), score={time_score:.4f}")
        
        logger.info("TIME ANALYSIS COMPLETE")
        logger.info("="*60)
        
        return results
    
    def _format_duration(self, duration_s: float) -> str:
        """
        Format duration in seconds to human-readable string.
        
        Args:
            duration_s: Duration in seconds
        
        Returns:
            Formatted string (e.g., "2h 30m", "45m")
        """
        if duration_s < 60:
            return f"{int(duration_s)}s"
        elif duration_s < 3600:
            minutes = int(duration_s / 60)
            return f"{minutes}m"
        else:
            hours = int(duration_s / 3600)
            minutes = int((duration_s % 3600) / 60)
            if minutes > 0:
                return f"{hours}h {minutes}m"
            return f"{hours}h"

