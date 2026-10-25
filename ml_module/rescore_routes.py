"""
Route Re-scoring Script

This script re-calculates resilience scores for existing routes with new user priorities.
It does NOT call Google Maps or fetch new routes - only recalculates scores.

Used when user adjusts priority sliders without changing origin/destination.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml_module.scoring.resilience_calculator import ResilienceCalculator
from ml_module.utils.logger import setup_logger

# Set up logging
logger = setup_logger("ml_module.rescore")


def rescore_routes(routes_data: List[Dict[str, Any]], priorities: Dict[str, float]) -> Dict[str, Any]:
    """
    Re-score existing routes with new priorities using only mathematical calculations.
    
    This function does NOT call Google Maps API or fetch weather data.
    It only recalculates resilience scores based on existing analysis data.
    
    Args:
        routes_data: List of enriched route dictionaries (already have all analysis data)
        priorities: Dict with time, distance, carbon_emission, road_quality (0-1)
    
    Returns:
        Dictionary with:
        - routes: Original routes (unchanged)
        - resilience_scores: New resilience scores
        - analysis_complete: Boolean status
    """
    try:
        logger.info("="*80)
        logger.info("ROUTE RE-SCORING STARTED")
        logger.info("="*80)
        logger.info(f"Re-scoring {len(routes_data)} routes")
        logger.info(f"New priorities: {json.dumps(priorities, indent=2)}")
        logger.info("NOTE: Using cached route data - no API calls will be made")
        
        if not routes_data:
            logger.warning("No routes data provided for re-scoring")
            return {
                "error": "No routes data provided",
                "routes": [],
                "resilience_scores": None,
                "analysis_complete": False
            }
        
        # Extract route names and existing scores
        route_names = []
        time_scores = {}
        distance_scores = {}
        carbon_scores = {}
        road_quality_scores = {}
        
        for route in routes_data:
            route_name = route.get("route_name", "Unknown")
            route_names.append(route_name)
            
            # Extract existing component scores
            time_scores[route_name] = route.get("time_score", 0.5)
            distance_scores[route_name] = route.get("distance_score", 0.5)
            carbon_scores[route_name] = route.get("carbon_score", 0.5)
            road_quality_scores[route_name] = route.get("road_quality_score", 0.5)
            
            logger.debug(f"Route '{route_name}': time={time_scores[route_name]:.4f}, "
                        f"dist={distance_scores[route_name]:.4f}, "
                        f"carbon={carbon_scores[route_name]:.4f}, "
                        f"road={road_quality_scores[route_name]:.4f}")
        
        # Initialize resilience calculator
        logger.info("\nInitializing Resilience Calculator...")
        calculator = ResilienceCalculator()
        
        # Recalculate resilience scores with new priorities
        logger.info("\nRecalculating resilience scores with new priorities...")
        resilience_results = calculator.calculate(
            routes=route_names,
            time_scores=time_scores,
            distance_scores=distance_scores,
            carbon_scores=carbon_scores,
            road_quality_scores=road_quality_scores,
            priorities=priorities
        )
        
        # Update routes with new resilience scores
        resilience_lookup = {r["route_name"]: r for r in resilience_results}
        
        updated_routes = []
        for route in routes_data:
            route_name = route.get("route_name", "Unknown")
            resilience_data = resilience_lookup.get(route_name, {})
            
            # Update route with new resilience score
            updated_route = route.copy()
            updated_route["overall_resilience_score"] = resilience_data.get("overall_resilience_score", 0)
            updated_route["component_scores"] = resilience_data.get("component_scores", {})
            updated_route["weighted_contributions"] = resilience_data.get("weighted_contributions", {})
            
            updated_routes.append(updated_route)
        
        # Format results
        formatted_scores = calculator.format_results(resilience_results)
        
        result = {
            "routes": updated_routes,
            "resilience_scores": formatted_scores,
            "analysis_complete": True
        }
        
        logger.info("="*80)
        logger.info("ROUTE RE-SCORING COMPLETE")
        logger.info(f"✓ Re-scored {len(updated_routes)} routes")
        logger.info(f"✓ New best route: {formatted_scores['best_route_name']}")
        logger.info("="*80)
        
        return result
        
    except Exception as e:
        logger.error(f"✗ Error in rescore_routes: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "routes": routes_data,  # Return original routes on error
            "resilience_scores": None,
            "analysis_complete": False
        }


if __name__ == "__main__":
    """
    Main entry point when script is called by backend.
    Reads JSON from stdin (with routes_data and priorities), processes, and outputs JSON to stdout.
    """
    try:
        logger.info("="*80)
        logger.info("ML MODULE STARTED (rescore_routes.py)")
        logger.info("="*80)
        logger.info("Reading input data from stdin...")
        
        # Read input from stdin
        input_json = sys.stdin.read()
        logger.debug(f"Raw input size: {len(input_json)} bytes")
        
        # Parse JSON
        input_data = json.loads(input_json)
        logger.info("✓ Input data parsed successfully")
        logger.debug(f"Parsed input keys: {list(input_data.keys())}")
        
        # Validate required fields
        if "routes_data" not in input_data:
            raise ValueError("Missing required field: routes_data")
        if "priorities" not in input_data:
            raise ValueError("Missing required field: priorities")
        
        routes_data = input_data["routes_data"]
        priorities = input_data["priorities"]
        
        logger.info(f"Routes to re-score: {len(routes_data)}")
        logger.info(f"Priorities: {priorities}")
        
        # Run re-scoring
        result = rescore_routes(
            routes_data=routes_data,
            priorities=priorities
        )
        
        # Output JSON result to stdout
        logger.info("\nOutputting JSON result to stdout...")
        output_json = json.dumps(result)
        logger.info(f"Output size: {len(output_json)} bytes")
        
        # Print to stdout (this goes to the backend)
        print(output_json)
        logger.info("✓ JSON output sent successfully to stdout")
        
        logger.info("="*80)
        logger.info("ML MODULE COMPLETED SUCCESSFULLY")
        logger.info("="*80)
        
    except json.JSONDecodeError as e:
        logger.error(f"✗ JSON decode error: {str(e)}")
        error_result = {
            "error": f"Invalid JSON input: {str(e)}",
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except ValueError as e:
        logger.error(f"✗ Validation error: {str(e)}")
        error_result = {
            "error": f"Validation error: {str(e)}",
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except KeyError as e:
        logger.error(f"✗ Missing required parameter: {str(e)}")
        error_result = {
            "error": f"Missing required parameter: {str(e)}",
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"✗ Unexpected error: {str(e)}", exc_info=True)
        error_result = {
            "error": str(e),
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }
        print(json.dumps(error_result))
        sys.exit(1)
