import sys
import os
import json
from pathlib import Path

# Add parent directory to path to ensure modules can be imported
# Assumes this script is in ml_module/analysis/
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml_module.analysis.gemini_summary import generate_summary

def test_gemini():
    # Mock Data for a route from Mumbai to Pune
    routes_data = [
        {
            "route_name": "Route 1",
            "distance_text": "150 km",
            "duration_text": "3 hours",
            "overall_resilience_score": 8.5,
            "component_scores": {
                "time_score": 0.9,
                "distance_score": 0.8, 
                "carbon_score": 0.7,
                "road_quality_score": 0.6
            },
            "avg_weather_risk": 0.2,
            "road_safety_score": 0.85,
            "carbon_score": 0.7,
            # Simple line between Mumbai and Pune
            "coordinates": [[19.0760, 72.8777], [18.5204, 73.8567]]
        }
    ]

    context = {
        "origin": "Mumbai",
        "destination": "Pune",
        "priorities": {"time": 0.5, "cost": 0.5}
    }

    print("Testing Gemini Summary Generation...")
    print(f"Input Routes: {len(routes_data)}")
    
    try:
        # Check API key presence first
        from ml_module.config.api_keys import get_gemini_key
        key = get_gemini_key()
        if not key:
            print("WARNING: GEMINI_API_KEY not found. Test will likely return empty result.")
        else:
            print("GEMINI_API_KEY found.")

        result = generate_summary(routes_data, context)
        print("\nGemini Output:")
        print(json.dumps(result, indent=2))
        
        if "Route 1" in result:
            data = result["Route 1"]
            if "route_name" in data and "short_summary" in data:
                print("\nSUCCESS: Gemini generated a named route summary.")
                return True
            else:
                print("\nFAILURE: Output missing required fields.")
                return False
        elif not result and not key:
             print("\nSKIPPED: No API Key, so empty result is expected.")
             return True
        else:
            print("\nFAILURE: Gemini returned unexpected format or empty.")
            return False
            
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if test_gemini():
        sys.exit(0)
    else:
        sys.exit(1)
