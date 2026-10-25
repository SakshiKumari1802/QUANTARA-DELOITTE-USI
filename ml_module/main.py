"""
Main Orchestrator for Supply Chain Route Analysis

Coordinates all analysis modules to:
1. Get routes from Google Maps API (with OSRM fallback)
2. Analyze time, distance, carbon emissions, road quality, and news sentiment
3. Calculate resilience scores based on user priorities
4. Return ranked routes with comprehensive metrics
"""

from typing import Dict, List, Optional, Tuple, Any
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml_module.routes.google_maps_client import GoogleMapsClient
from ml_module.routes.osrm_client import OSRMClient
from ml_module.analysis.time_analysis import TimeAnalyzer
from ml_module.analysis.distance_analysis import DistanceAnalyzer
from ml_module.analysis.carbon_analysis import CarbonAnalyzer
from ml_module.analysis.road_analysis import RoadAnalyzer
from ml_module.analysis.weather_analysis import WeatherAnalyzer
from ml_module.analysis.segmentation import extract_segments_for_routes
from ml_module.analysis.road_safety_score import RoadSafetyScorer
from ml_module.analysis.news_analysis import fetch_route_news
from ml_module.scoring.resilience_calculator import ResilienceCalculator
from ml_module.analysis.gemini_summary import generate_summary
from ml_module.utils.logger import get_logger

logger = get_logger("ml_module.main")


class RouteAnalysisSystem:
    """
    Main orchestrator for route analysis system.
    
    Coordinates route fetching, analysis, and scoring to provide
    comprehensive route recommendations.
    """
    
    def __init__(self):
        """Initialize all components of the analysis system."""
        logger.info("="*60)
        logger.info("INITIALIZING ROUTE ANALYSIS SYSTEM")
        logger.info("="*60)
        
        # Initialize route clients
        self.google_maps_client = GoogleMapsClient()
        self.osrm_client = OSRMClient()
        
        # Initialize analyzers
        self.time_analyzer = TimeAnalyzer()
        self.distance_analyzer = DistanceAnalyzer()
        self.carbon_analyzer = CarbonAnalyzer()
        self.weather_analyzer = WeatherAnalyzer()
        self.road_analyzer = RoadAnalyzer()
        self.road_safety_scorer = RoadSafetyScorer()
        
        # Initialize helper functions
        self.generate_summary = generate_summary
        
        # Initialize scorer
        self.resilience_calculator = ResilienceCalculator()
        
        logger.info("All components initialized successfully")
        logger.info("="*60)
    
    def analyze_routes(self,
                      origin: Tuple[float, float],
                      destination: Tuple[float, float],
                      user_priorities: Optional[Dict[str, float]] = None,
                      origin_name: Optional[str] = None,
                      destination_name: Optional[str] = None,
                      max_alternatives: int = 3,
                      osmnx_enabled: Optional[bool] = None,
                      previous_route_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main function to analyze routes and return resilience scores.
        
        Args:
            origin: (latitude, longitude) of origin
            destination: (latitude, longitude) of destination
            user_priorities: Dictionary with user priorities/weights:
                - time: Weight for time (0-1)
                - distance: Weight for distance (0-1)
                - carbon_emission: Weight for carbon emission (0-1)
                - road_quality: Weight for road quality (0-1)
            origin_name: Optional name of origin location
            destination_name: Optional name of destination location
            max_alternatives: Maximum number of alternative routes to analyze
            osmnx_enabled: Optional override for OSMnx
            previous_route_data: Optional previous route data for comparison (reroute)
        
        Returns:
            Dictionary with:
            - routes: List of route dictionaries with all analysis data
            - resilience_scores: Resilience scoring results
            - best_route: Best route name
            - analysis_complete: Boolean status
            - comparison_report: Comparison with previous route (if reroute)
        """
        logger.info("="*80)
        logger.info("STARTING COMPREHENSIVE ROUTE ANALYSIS")
        logger.info("="*80)
        logger.info(f"Origin: {origin_name or origin}")
        logger.info(f"Destination: {destination_name or destination}")
        logger.info(f"User priorities: {user_priorities}")
        logger.info(f"Max alternatives: {max_alternatives}")
        if osmnx_enabled is not None:
            logger.info(f"OSMnx enabled (override from caller): {osmnx_enabled}")
        
        # Set default priorities if not provided
        if not user_priorities:
            user_priorities = {
                "time": 0.20,
                "distance": 0.20,
                "carbon_emission": 0.20,
                "road_quality": 0.20,
                "news_sentiment": 0.20  # Always enabled by default
            }
            logger.info(f"Using default priorities: {user_priorities}")
        
        # Ensure news_sentiment priority exists (default to 20% if not provided)
        if "news_sentiment" not in user_priorities:
            user_priorities["news_sentiment"] = 0.20
        
        try:
            # Step 1: Get routes from Google Maps (with OSRM fallback)
            logger.info("\n" + "="*60)
            logger.info("STEP 1: FETCHING ROUTES")
            logger.info("="*60)
            
            routes = self._get_routes(origin, destination, max_alternatives)
            
            if not routes:
                logger.error("No routes found. Cannot proceed with analysis.")
                return {
                    "error": "No routes found",
                    "routes": [],
                    "resilience_scores": None,
                    "analysis_complete": False
                }
            
            logger.info(f"✓ Found {len(routes)} route(s)")
            
            # Add route names
            for i, route in enumerate(routes):
                if "route_name" not in route or not route["route_name"]:
                    route["route_name"] = f"Route {i + 1}"
            
            # Step 2: Run parallel analyses
            logger.info("\n" + "="*60)
            logger.info("STEP 2: RUNNING ANALYSES")
            logger.info("="*60)
            
            # Time analysis
            logger.info("\n→ TIME ANALYSIS")
            time_results = self.time_analyzer.analyze(routes)
            time_scores = {r["route_name"]: r["time_score"] for r in time_results}

            # Distance analysis
            logger.info("\n→ DISTANCE ANALYSIS")
            distance_results = self.distance_analyzer.analyze(routes)
            distance_scores = {r["route_name"]: r["distance_score"] for r in distance_results}

            # Extract segments for all routes (called from main.py as requested)
            logger.info(f"\n→ Extracting segments for {len(routes)} route(s)")
            segments_data = extract_segments_for_routes(routes)
            
            # [Refactored] Consolidated Analysis via RoadSafetyScorer
            # This replaces separate Weather and Road analysis calls
            logger.info("\n→ SAFETY, WEATHER & ROAD ANALYSIS")
            
            weather_results = []
            road_results = []
            safety_scores = {}
            
            for idx, data in enumerate(segments_data):
                route_name = data[0]
                
                # Perform full analysis
                analysis_result = self.road_safety_scorer.calculate(
                    segment_data=data,
                    osmnx_enabled=osmnx_enabled
                )
                
                # Extract components
                safety_score = analysis_result["road_safety_score"]
                w_result = analysis_result["weather_analysis"]
                r_result = analysis_result["road_analysis"]
                
                # Add route name to results as expected by downstream logic
                w_result["route_name"] = route_name
                r_result["route_name"] = route_name
                
                # Store
                safety_scores[route_name] = safety_score
                weather_results.append(w_result)
                road_results.append(r_result)
                
            road_quality_scores = {r["route_name"]: r.get("road_quality_score", 0) for r in road_results}
            
            # Carbon analysis
            logger.info("\n→ CARBON EMISSION ANALYSIS")
            carbon_results = self.carbon_analyzer.analyze(routes)
            carbon_scores = {r["route_name"]: r["carbon_score"] for r in carbon_results}
            
            # Fetch news articles if sentiment analysis is enabled
            news_sentiment_scores = {}
            news_articles_for_gemini = None
            news_sentiment_priority = user_priorities.get("news_sentiment", 0)
            
            if news_sentiment_priority > 0:
                logger.info("\n→ FETCHING NEWS FOR SENTIMENT ANALYSIS")
                
                # Collect cities for news search
                route_cities = set()
                if origin_name:
                    route_cities.add(origin_name.split(",")[0].strip())
                if destination_name:
                    route_cities.add(destination_name.split(",")[0].strip())
                
                if route_cities:
                    cities_list = list(route_cities)
                    logger.info(f"Fetching news for cities: {cities_list}")
                    articles = fetch_route_news(cities_list, max_articles=10)
                    
                    if articles:
                        logger.info(f"Fetched {len(articles)} news articles for Gemini analysis")
                        # Convert to dict format for Gemini
                        news_articles_for_gemini = [
                            {
                                "title": a.title,
                                "description": a.description,
                                "source": a.source,
                                "published_at": a.published_at
                            }
                            for a in articles
                        ]
                    else:
                        logger.info("No news articles found")
            else:
                logger.info("\n→ NEWS SENTIMENT ANALYSIS (SKIPPED - priority is 0)")
            
            logger.info("\n✓ All analyses complete")
            
            # Step 3: Calculate preliminary resilience scores (without news sentiment)
            logger.info("\n" + "="*60)
            logger.info("STEP 3: CALCULATING PRELIMINARY RESILIENCE SCORES")
            logger.info("="*60)
            
            route_names = [r["route_name"] for r in routes]
            
            # Temporary scores for Gemini context (assume neutral sentiment 0.5 initially)
            temp_sentiment_scores = {name: 0.5 for name in route_names}
            
            preliminary_results = self.resilience_calculator.calculate(
                routes=route_names,
                time_scores=time_scores,
                distance_scores=distance_scores,
                carbon_scores=carbon_scores,
                road_quality_scores=road_quality_scores,
                priorities=user_priorities,
                news_sentiment_scores=temp_sentiment_scores 
            )
            
            # Create a lookup for preliminary results
            prelim_lookup = {r["route_name"]: r for r in preliminary_results}

            # Step 4: Gemini Summary Generation (combined with news sentiment)
            logger.info("\n" + "="*60)
            logger.info("STEP 4: GENERATING GEMINI SUMMARIES" + (" + NEWS SENTIMENT" if news_articles_for_gemini else ""))
            logger.info("="*60)
            
            # Prepare data for Gemini (pre-enrichment)
            temp_routes_data = []
            for i, r in enumerate(routes):
                r_name = r["route_name"]
                prelim_data = prelim_lookup.get(r_name, {})
                
                temp_routes_data.append({
                    "route_name": r_name,
                    "distance_text": distance_scores.get(r_name, {}),
                    "avg_weather_risk": road_results[i]["avg_weather_risk"] if i < len(road_results) else 0,
                    "road_safety_score": safety_scores.get(r_name, 0.5),
                    "carbon_score": carbon_scores.get(r_name, 0),
                    "coordinates": r.get("coordinates", []),
                    # Pass the preliminary score to Gemini
                    "overall_resilience_score": prelim_data.get("overall_resilience_score", 0),
                    "component_scores": prelim_data.get("component_scores", {})
                })
            
            # Combined Gemini call (summary + sentiment + optional comparison)
            is_reroute = previous_route_data is not None
            if is_reroute:
                logger.info("REROUTE DETECTED - will include comparison report")
            
            gemini_combined_results = self.generate_summary(
                routes_data=temp_routes_data,
                overall_context={
                    "origin": origin_name,
                    "destination": destination_name,
                    "priorities": user_priorities
                },
                news_articles=news_articles_for_gemini,
                previous_route_data=previous_route_data
            )
            
            # Extract routes and sentiment from combined result
            gemini_results = gemini_combined_results.get("routes", gemini_combined_results)
            news_sentiment_result = gemini_combined_results.get("news_sentiment", {})
            comparison_report = gemini_combined_results.get("comparison_report", None)
            
            if comparison_report:
                logger.info(f"Comparison report generated: {comparison_report.get('summary', 'N/A')[:80]}...")
            
            # Extract sentiment score if news analysis was done
            if news_sentiment_priority > 0 and news_articles_for_gemini:
                sentiment_score = news_sentiment_result.get("sentiment_score", 0.5)
                logger.info(f"News sentiment score from Gemini: {sentiment_score:.2f}")
                
                # Apply same sentiment score to all routes
                for route in routes:
                    news_sentiment_scores[route.get("route_name", "Unknown")] = sentiment_score
            
            # Now calculate final resilience scores with news sentiment
            logger.info("\n" + "="*60)
            logger.info("STEP 5: CALCULATING FINAL RESILIENCE SCORES")
            logger.info("="*60)
            
            resilience_results = self.resilience_calculator.calculate(
                routes=route_names,
                time_scores=time_scores,
                distance_scores=distance_scores,
                carbon_scores=carbon_scores,
                road_quality_scores=road_quality_scores,
                priorities=user_priorities,
                news_sentiment_scores=news_sentiment_scores if news_sentiment_priority > 0 else None
            )
            
            # Update temp_routes_data with resilience scores for combine step
            for i, r_data in enumerate(temp_routes_data):
                if i < len(resilience_results):
                    r_data["overall_resilience_score"] = resilience_results[i]["overall_resilience_score"]
                    r_data["component_scores"] = resilience_results[i]["component_scores"]

            # Step 6: Combine all results into enriched routes
            logger.info("\n" + "="*60)
            logger.info("STEP 6: COMBINING RESULTS")
            logger.info("="*60)
            
            enriched_routes = self._combine_results(
                routes=routes,
                time_results=time_results,
                distance_results=distance_results,
                carbon_results=carbon_results,
                road_results=road_results,
                resilience_results=resilience_results,
                safety_scores=safety_scores,
                gemini_results=gemini_results,
                news_sentiment_result=news_sentiment_result if news_sentiment_priority > 0 else None
            )
            
            # Format resilience scores for output
            formatted_scores = self.resilience_calculator.format_results(resilience_results)
            
            result = {
                "routes": enriched_routes,
                "resilience_scores": formatted_scores,
                "best_route": formatted_scores["best_route_name"],
                "analysis_complete": True,
                "comparison_report": comparison_report,
                "is_reroute": is_reroute
            }
            
            logger.info("="*80)
            logger.info("COMPREHENSIVE ROUTE ANALYSIS COMPLETE")
            logger.info(f"✓ Analyzed {len(enriched_routes)} routes")
            logger.info(f"✓ Best route: {formatted_scores['best_route_name']}")
            logger.info(f"✓ Reason: {formatted_scores['reason_for_selection']}")
            if is_reroute:
                logger.info("✓ Comparison report included (reroute)")
            logger.info("="*80)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in route analysis: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "routes": [],
                "resilience_scores": None,
                "analysis_complete": False
            }
    
    def _get_routes(self,
                   origin: Tuple[float, float],
                   destination: Tuple[float, float],
                   max_alternatives: int = 3) -> List[Dict[str, Any]]:
        """
        Get routes from Google Maps API with OSRM fallback.
        
        Args:
            origin: (lat, lon) of origin
            destination: (lat, lon) of destination
            max_alternatives: Maximum number of alternative routes
        
        Returns:
            List of route dictionaries
        """
        # Try Google Maps first
        logger.info("Attempting Google Maps API...")
        routes = self.google_maps_client.get_directions(
            origin=origin,
            destination=destination,
            alternatives=True
        )
        
        if routes:
            logger.info(f"✓ Google Maps returned {len(routes)} route(s)")
            return routes[:max_alternatives]
        
        # Fallback to OSRM
        logger.warning("Google Maps unavailable, trying OSRM fallback...")
        
        if self.osrm_client.is_available():
            logger.info("OSRM service is available")
            routes = self.osrm_client.get_directions(
                origin=origin,
                destination=destination,
                alternatives=True
            )
            
            if routes:
                logger.info(f"✓ OSRM returned {len(routes)} route(s)")
                return routes[:max_alternatives]
        
        logger.error("Both Google Maps and OSRM failed")
        return []
    
    def _combine_results(self,
                        routes: List[Dict[str, Any]],
                        time_results: List[Dict[str, Any]],
                        distance_results: List[Dict[str, Any]],
                        carbon_results: List[Dict[str, Any]],
                        road_results: List[Dict[str, Any]],
                        resilience_results: List[Dict[str, Any]],
                        safety_scores: Dict[str, float],
                        gemini_results: Optional[Dict[str, Any]] = None,
                        news_sentiment_result: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Combine all analysis results into enriched route dictionaries.
        
        Args:
            routes: Original route data
            time_results: Time analysis results
            distance_results: Distance analysis results
            carbon_results: Carbon analysis results
            road_results: Road analysis results
            resilience_results: Resilience calculation results
            safety_scores: Road safety scores
            gemini_results: Gemini route analysis results
            news_sentiment_result: News sentiment analysis results (optional)
        
        Returns:
            List of enriched route dictionaries
        """
        # Create lookup dictionaries
        time_lookup = {r["route_name"]: r for r in time_results}
        distance_lookup = {r["route_name"]: r for r in distance_results}
        carbon_lookup = {r["route_name"]: r for r in carbon_results}
        road_lookup = {r["route_name"]: r for r in road_results}
        resilience_lookup = {r["route_name"]: r for r in resilience_results}
        
        enriched = []
        
        for route in routes:
            route_name = route.get("route_name", "Unknown")
            
            # Get analysis results for this route
            time_data = time_lookup.get(route_name, {})
            distance_data = distance_lookup.get(route_name, {})
            carbon_data = carbon_lookup.get(route_name, {})
            road_data = road_lookup.get(route_name, {})
            resilience_data = resilience_lookup.get(route_name, {})
            safety_score = safety_scores.get(route_name, 0.5)
            
            # Get Gemini analysis for this route
            gemini_data = {}
            if gemini_results:
                gemini_data = gemini_results.get(route_name, {})
                
            # --- LIMIT INTERMEDIATE CITIES TO 2 ---
            raw_intermediate = gemini_data.get("intermediate_cities", [])

            intermediate_cities = [
                {
                    "name": city.get("name"),
                    "lat": city.get("lat"),
                    "lon": city.get("lon")
                }
                for city in raw_intermediate
                if isinstance(city, dict)
                and "lat" in city
                and "lon" in city
            ][:2]

                
            # Combine into enriched route
            enriched_route = {
                "route_name": gemini_data.get("route_name", route_name),
                
                # Original route data
                "distance_m": route.get("distance_m", 0),
                "duration_s": route.get("duration_s", 0),
                "steps": route.get("steps", []),
                "coordinates": route.get("coordinates", []),
                "overview_polyline": route.get("overview_polyline", ""),
                
                # Time analysis
                "predicted_duration_min": time_data.get("duration_s", 0) / 60,
                "duration_text": time_data.get("duration_text", ""),
                "time_score": time_data.get("time_score", 0),
                
                # Distance analysis
                "distance_text": distance_data.get("distance_text", ""),
                "distance_score": distance_data.get("distance_score", 0),
                
                # Carbon analysis
                "total_carbon_kg": carbon_data.get("total_carbon_kg", 0),
                "carbon_score": carbon_data.get("carbon_score", 0),
                "carbon_per_km": carbon_data.get("carbon_per_km", 0),
                
                # Road analysis
                "road_segments": road_data.get("road_segments", []),
                "road_quality_score": road_data.get("road_quality_score", 0),
                "avg_weather_risk": road_data.get("avg_weather_risk", 0),
                "total_rainfall": road_data.get("total_rainfall", 0),
                "road_type_distribution": road_data.get("road_type_distribution", {}),
                
                # Road Safety Score
                "road_safety_score": safety_score,
                
                # News Sentiment (if available)
                "news_sentiment_score": resilience_data.get("component_scores", {}).get("news_sentiment_score", 0.5),
                
                # Resilience score
                "overall_resilience_score": resilience_data.get("overall_resilience_score", 0),
                "component_scores": resilience_data.get("component_scores", {}),
                "weighted_contributions": resilience_data.get("weighted_contributions", {}),
                
                # Gemini Analysis
                "gemini_analysis": {
                    "route_name": gemini_data.get("route_name", route_name),
                    "short_summary": gemini_data.get("short_summary", "Analysis pending..."),
                    "reasoning": gemini_data.get("reasoning", "Detailed analysis not available."),
                    "intermediate_cities": intermediate_cities,
                    "weather_risk_score": road_data.get("avg_weather_risk", 0) * 100,
                    "road_safety_score": safety_score * 100,
                    "carbon_score": carbon_data.get("carbon_score", 0) * 100,
                    "overall_resilience_score": resilience_data.get("overall_resilience_score", 0)
                }
            }
            
            # Add news sentiment analysis if available
            if news_sentiment_result:
                enriched_route["news_sentiment_analysis"] = {
                    "sentiment_score": news_sentiment_result.get("sentiment_score", 0.5),
                    "risk_factors": news_sentiment_result.get("risk_factors", []),
                    "positive_factors": news_sentiment_result.get("positive_factors", []),
                    "reasoning": news_sentiment_result.get("reasoning", ""),
                    "article_sentiments": news_sentiment_result.get("article_sentiments", [])
                }
                enriched_route["gemini_analysis"]["news_sentiment_score"] = news_sentiment_result.get("sentiment_score", 0.5) * 100
            
            enriched.append(enriched_route)
            
            logger.debug(f"Combined results for '{route_name}': "
                        f"resilience={enriched_route['overall_resilience_score']:.2f}")
        
        logger.info(f"✓ Combined data for {len(enriched)} routes")
        
        return enriched

if __name__ == "__main__":
    try:
        # Simple argument parsing
        # Usage: python main.py "Origin" "Destination" '{"time": 0.5, ...}'
        
        if len(sys.argv) < 3:
            logger.error("Usage: python main.py <origin> <destination> [priorities_json]")
            # Print empty JSON to avoid crashing node parser if possible, or just exit
            print(json.dumps({"error": "Missing arguments"}))
            sys.exit(1)
            
        origin = sys.argv[1]
        destination = sys.argv[2]
        
        priorities = None
        if len(sys.argv) > 3:
            try:
                priorities = json.loads(sys.argv[3])
            except:
                logger.warning("Could not parse priorities JSON, using defaults")
        
        system = RouteAnalysisSystem()
        result = system.analyze_routes(origin, destination, priorities)
        
        # Output result as JSON to stdout
        print(json.dumps(result, default=str))
        
    except Exception as e:
        logger.error(f"Critical System Error: {str(e)}")
        print(json.dumps({"error": str(e), "status": "error"}))
        sys.exit(1)
