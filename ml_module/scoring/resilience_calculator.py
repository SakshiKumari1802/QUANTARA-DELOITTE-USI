"""
Resilience Calculator Module

Combines all analysis scores into a weighted resilience score based on user priorities.
Formula: resilience_score = Σ(priority_i * score_i) * 100

Components:
- time: Route travel time efficiency
- distance: Route length efficiency
- carbon_emission: Carbon emissions score
- road_quality: Road conditions score
- news_sentiment: Route news sentiment score (optional)
"""

from typing import List, Dict, Any, Optional
from ..utils.logger import get_logger

logger = get_logger("ml_module.scoring.resilience")


class ResilienceCalculator:
    """
    Calculator for overall route resilience scores.
    
    Combines time, distance, carbon, road quality, and news sentiment scores using
    user-defined priorities to produce final resilience scores.
    """
    
    def __init__(self):
        """Initialize the Resilience Calculator."""
        logger.info("ResilienceCalculator initialized")
    
    def calculate(self,
                  routes: List[str],
                  time_scores: Dict[str, float],
                  distance_scores: Dict[str, float],
                  carbon_scores: Dict[str, float],
                  road_quality_scores: Dict[str, float],
                  priorities: Dict[str, float],
                  news_sentiment_scores: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
        """
        Calculate resilience scores for all routes.
        
        Args:
            routes: List of route names
            time_scores: Dict mapping route_name -> time_score (0-1)
            distance_scores: Dict mapping route_name -> distance_score (0-1)
            carbon_scores: Dict mapping route_name -> carbon_score (0-1)
            road_quality_scores: Dict mapping route_name -> road_quality_score (0-1)
            priorities: Dict with keys: time, distance, carbon_emission, road_quality, news_sentiment
            news_sentiment_scores: Optional dict mapping route_name -> news_sentiment_score (0-1)
        
        Returns:
            List of dictionaries with resilience scores:
                - route_name: Route identifier
                - overall_resilience_score: Final score (0-100)
                - component_scores: Individual scores dict
                - weighted_contributions: Weighted component contributions
        """
        logger.info("="*60)
        logger.info("RESILIENCE CALCULATION STARTED")
        logger.info(f"Processing {len(routes)} routes")
        logger.info(f"User priorities: {priorities}")
        
        # Default news_sentiment_scores if not provided
        if news_sentiment_scores is None:
            news_sentiment_scores = {}
        
        # Check if news_sentiment is enabled (priority > 0)
        news_sentiment_enabled = priorities.get("news_sentiment", 0) > 0
        if news_sentiment_enabled:
            logger.info("News sentiment analysis is ENABLED")
        
        # Normalize priorities to ensure they sum to 1.0
        total_priority = sum(priorities.values())
        if total_priority == 0:
            logger.warning("Total priority is 0, using equal weights")
            priorities = {
                "time": 0.20,
                "distance": 0.20,
                "carbon_emission": 0.20,
                "road_quality": 0.20,
                "news_sentiment": 0.20
            }
            total_priority = 1.0
        
        if abs(total_priority - 1.0) > 0.01:
            logger.info(f"Normalizing priorities (sum={total_priority:.3f})")
            priorities = {k: v / total_priority for k, v in priorities.items()}
            logger.info(f"Normalized priorities: {priorities}")
        
        # Extract priority values
        time_priority = priorities.get("time", 0.25)
        distance_priority = priorities.get("distance", 0.25)
        carbon_priority = priorities.get("carbon_emission", 0.25)
        road_priority = priorities.get("road_quality", 0.25)
        news_priority = priorities.get("news_sentiment", 0.0)
        
        results = []
        
        for route_name in routes:
            # Get component scores (with defaults)
            time_score = time_scores.get(route_name, 0.5)
            distance_score = distance_scores.get(route_name, 0.5)
            carbon_score = carbon_scores.get(route_name, 0.5)
            road_quality_score = road_quality_scores.get(route_name, 0.5)
            news_sentiment_score = news_sentiment_scores.get(route_name, 0.5)
            
            # Calculate weighted contributions
            time_contribution = time_priority * time_score
            distance_contribution = distance_priority * distance_score
            carbon_contribution = carbon_priority * carbon_score
            road_contribution = road_priority * road_quality_score
            news_contribution = news_priority * news_sentiment_score
            
            # Calculate overall resilience score (0-1 scale)
            resilience_score = (
                time_contribution +
                distance_contribution +
                carbon_contribution +
                road_contribution +
                news_contribution
            )
            
            # Convert to 0-100 scale
            resilience_score_100 = resilience_score * 100
            
            # Ensure score is in valid range
            resilience_score_100 = max(0.0, min(100.0, resilience_score_100))
            
            result = {
                "route_name": route_name,
                "overall_resilience_score": resilience_score_100,
                "component_scores": {
                    "time_score": time_score,
                    "distance_score": distance_score,
                    "carbon_score": carbon_score,
                    "road_quality_score": road_quality_score,
                    "news_sentiment_score": news_sentiment_score
                },
                "weighted_contributions": {
                    "time": time_contribution,
                    "distance": distance_contribution,
                    "carbon": carbon_contribution,
                    "road_quality": road_contribution,
                    "news_sentiment": news_contribution
                }
            }
            
            results.append(result)
            
            logger.info(f"Route '{route_name}':")
            logger.info(f"  Component scores: time={time_score:.4f}, distance={distance_score:.4f}, "
                       f"carbon={carbon_score:.4f}, road={road_quality_score:.4f}, news={news_sentiment_score:.4f}")
            logger.info(f"  Weighted contributions: time={time_contribution:.4f}, "
                       f"distance={distance_contribution:.4f}, carbon={carbon_contribution:.4f}, "
                       f"road={road_contribution:.4f}, news={news_contribution:.4f}")
            logger.info(f"  Overall resilience score: {resilience_score_100:.2f}/100")
        
        # Sort by resilience score (highest first)
        results.sort(key=lambda x: x["overall_resilience_score"], reverse=True)
        
        # Log ranking
        logger.info("Route ranking by resilience score:")
        for i, result in enumerate(results, 1):
            logger.info(f"  {i}. {result['route_name']}: {result['overall_resilience_score']:.2f}")
        
        logger.info("RESILIENCE CALCULATION COMPLETE")
        logger.info("="*60)
        
        return results
    
    def format_results(self, resilience_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Format resilience results for output.
        
        Args:
            resilience_results: List of resilience calculation results
        
        Returns:
            Formatted dictionary with routes, ranked_routes, and best_route
        """
        if not resilience_results:
            return {
                "routes": [],
                "ranked_routes": [],
                "best_route_name": None,
                "reason_for_selection": "No routes available"
            }
        
        best_route = resilience_results[0]
        ranked_routes = [r["route_name"] for r in resilience_results]
        
        # Generate reason for selection
        best_components = best_route["component_scores"]
        reason_parts = []
        
        # Find strongest aspects
        if best_components["time_score"] > 0.8:
            reason_parts.append("excellent time efficiency")
        if best_components["distance_score"] > 0.8:
            reason_parts.append("shortest distance")
        if best_components["carbon_score"] > 0.8:
            reason_parts.append("lowest carbon emissions")
        if best_components["road_quality_score"] > 0.8:
            reason_parts.append("superior road conditions")
        if best_components.get("news_sentiment_score", 0.5) > 0.7:
            reason_parts.append("favorable news sentiment")
        
        if not reason_parts:
            reason = "Best overall balance of all factors"
        else:
            reason = f"Best route due to: {', '.join(reason_parts)}"
        
        formatted = {
            "routes": resilience_results,
            "ranked_routes": ranked_routes,
            "best_route_name": best_route["route_name"],
            "reason_for_selection": reason
        }
        
        return formatted

