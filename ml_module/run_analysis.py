"""
Entry Point for Route Analysis

This script is called by the backend with JSON input via stdin.
It coordinates the full route analysis process and outputs JSON results to stdout.

This module is coordinate-agnostic and does NOT perform geocoding.
All coordinates must be provided by the backend API after geocoding user-selected locations.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml_module.main import RouteAnalysisSystem
from ml_module.utils.logger import setup_logger

# Set up logging
logger = setup_logger("ml_module.run_analysis")


def run_analysis(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    origin_name: Optional[str] = None,
    dest_name: Optional[str] = None,
    priorities: Optional[Dict[str, float]] = None,
    osmnx_enabled: Optional[bool] = None,
    previous_route_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run comprehensive route analysis with coordinates provided by backend.
    
    This function is coordinate-agnostic and does NOT perform geocoding.
    All coordinates must be provided by the backend API.
    
    Args:
        origin_lat: Origin latitude (float)
        origin_lng: Origin longitude (float)
        dest_lat: Destination latitude (float)
        dest_lng: Destination longitude (float)
        origin_name: Optional origin location name (for display/logging only)
        dest_name: Optional destination location name (for display/logging only)
        priorities: Optional dict with user priorities (0-1 range)
        osmnx_enabled: Optional override for OSMnx
        previous_route_data: Optional previous route data for reroute comparison
    
    Returns:
        Dictionary with analysis results:
        - routes: List of enriched route dictionaries
        - resilience_scores: Resilience scoring results
        - best_route: Best route name
        - analysis_complete: Boolean indicating completion status
        - comparison_report: Comparison with previous route (if reroute)
        - is_reroute: Boolean indicating if this is a reroute
        - error: Error message if analysis failed
    """
    try:
        logger.info("="*80)
        logger.info("ROUTE ANALYSIS ENTRY POINT CALLED")
        logger.info("="*80)
        logger.info(f"Origin: {origin_name or 'Unknown'} ({origin_lat}, {origin_lng})")
        logger.info(f"Destination: {dest_name or 'Unknown'} ({dest_lat}, {dest_lng})")
        logger.info(f"User Priorities: {json.dumps(priorities or {}, indent=2)}")
        if osmnx_enabled is not None:
            logger.info(f"OSMnx enabled (override from caller): {osmnx_enabled}")
        if previous_route_data:
            logger.info(f"REROUTE: Previous route data provided - {previous_route_data.get('route_name', 'Unknown')}")
        logger.info("NOTE: Coordinates provided by backend - no geocoding performed in ML module")
        
        # Validate coordinates
        if not (-90 <= origin_lat <= 90) or not (-180 <= origin_lng <= 180):
            raise ValueError(f"Invalid origin coordinates: ({origin_lat}, {origin_lng})")
        if not (-90 <= dest_lat <= 90) or not (-180 <= dest_lng <= 180):
            raise ValueError(f"Invalid destination coordinates: ({dest_lat}, {dest_lng})")
        
        # Initialize system
        logger.info("\nInitializing Route Analysis System...")
        system = RouteAnalysisSystem()
        logger.info("✓ System initialized successfully")
        
        # Run analysis
        logger.info("\nStarting comprehensive route analysis...")
        result = system.analyze_routes(
            origin=(origin_lat, origin_lng),
            destination=(dest_lat, dest_lng),
            user_priorities=priorities,
            origin_name=origin_name,
            destination_name=dest_name,
            max_alternatives=3,
            osmnx_enabled=osmnx_enabled,
            previous_route_data=previous_route_data,
        )
        
        # Log results summary
        if result.get("error"):
            logger.error(f"✗ Analysis failed: {result['error']}")
        else:
            logger.info(f"\n✓ Analysis completed successfully")
            logger.info(f"✓ Number of routes found: {len(result.get('routes', []))}")
            
            if result.get("resilience_scores"):
                scores_data = result["resilience_scores"]
                best_route = scores_data.get("best_route_name", "N/A")
                logger.info(f"✓ Best route: {best_route}")
                
                logger.info("\nRoute Rankings:")
                for i, route_name in enumerate(scores_data.get("ranked_routes", []), 1):
                    # Find score for this route
                    route_score = next(
                        (r["overall_resilience_score"] for r in scores_data.get("routes", [])
                         if r["route_name"] == route_name),
                        0
                    )
                    logger.info(f"  {i}. {route_name}: Score = {route_score:.2f}/100")
        
        logger.info("="*80)
        logger.info("ROUTE ANALYSIS ENTRY POINT COMPLETE")
        logger.info("="*80)
        
        return result
        
    except ValueError as e:
        logger.error(f"✗ Validation error: {str(e)}")
        return {
            "error": f"Validation error: {str(e)}",
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }
    except Exception as e:
        logger.error(f"✗ Unexpected error in run_analysis: {str(e)}", exc_info=True)
        return {
            "error": str(e),
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }


if __name__ == "__main__":
    """
    Main entry point when script is called by backend.
    Reads JSON from stdin, processes, and outputs JSON to stdout.
    """
    try:
        logger.info("="*80)
        logger.info("ML MODULE STARTED (run_analysis.py)")
        logger.info("="*80)
        logger.info("Reading input data from stdin...")
        
        # Read input from stdin
        input_json = sys.stdin.read()
        logger.debug(f"Raw input (first 300 chars): {input_json[:300]}...")
        
        # Parse JSON
        input_data = json.loads(input_json)
        logger.info("✓ Input data parsed successfully")
        logger.debug(f"Parsed input keys: {list(input_data.keys())}")
        
        # Validate required fields
        required_fields = ["source_lat", "source_lon", "dest_lat", "dest_lon"]
        missing_fields = [field for field in required_fields if field not in input_data]
        
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
        
        # Run analysis with provided coordinates
        result = run_analysis(
            origin_lat=float(input_data["source_lat"]),
            origin_lng=float(input_data["source_lon"]),
            dest_lat=float(input_data["dest_lat"]),
            dest_lng=float(input_data["dest_lon"]),
            origin_name=input_data.get("source_name"),
            dest_name=input_data.get("dest_name"),
            priorities=input_data.get("priorities"),
            osmnx_enabled=input_data.get("osmnx_enabled"),
            previous_route_data=input_data.get("previous_route_data"),
        )
        
        # Output JSON result to stdout
        logger.info("\nOutputting JSON result to stdout...")
        output_json = json.dumps(result)
        logger.info(f"Output size: {len(output_json)} bytes")
        logger.debug(f"Output (first 300 chars): {output_json[:300]}...")
        
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
