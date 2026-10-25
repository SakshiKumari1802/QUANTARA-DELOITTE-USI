"""
Python API server for ML module route analysis
Can be called from Node.js backend
"""

import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml_module.main import SupplyChainReroutingSystem

def analyze_routes_api(source_lat, source_lon, dest_lat, dest_lon, source_name, dest_name, priorities):
    """
    API function to analyze routes
    
    Args:
        source_lat, source_lon: Source coordinates
        dest_lat, dest_lon: Destination coordinates
        source_name, dest_name: Location names
        priorities: Dict with time, distance, safety, carbon_emission (0-1)
    
    Returns:
        JSON string with analysis results
    """
    try:
        system = SupplyChainReroutingSystem()
        result = system.analyze_routes(
            origin=(source_lat, source_lon),
            destination=(dest_lat, dest_lon),
            user_priorities=priorities,
            origin_name=source_name,
            destination_name=dest_name
        )
        return json.dumps(result)
    except Exception as e:
        error_result = {
            "error": str(e),
            "routes": [],
            "resilience_scores": None,
            "analysis_complete": False
        }
        return json.dumps(error_result)

if __name__ == "__main__":
    # Read from stdin
    input_data = json.loads(sys.stdin.read())
    
    result = analyze_routes_api(
        source_lat=input_data["source_lat"],
        source_lon=input_data["source_lon"],
        dest_lat=input_data["dest_lat"],
        dest_lon=input_data["dest_lon"],
        source_name=input_data["source_name"],
        dest_name=input_data["dest_name"],
        priorities=input_data["priorities"]
    )
    
    print(result)


