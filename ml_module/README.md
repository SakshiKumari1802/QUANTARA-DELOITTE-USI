# Supply Chain Rerouting and Resilience Scoring System

A modular Python system for analyzing supply chain routes with resilience scoring using Google Maps APIs and Gemini AI.

## Features

- **Route Analysis**: Get multiple route alternatives using Google Maps Directions API (with OpenRouteService fallback)
- **Weather Data**: Real-time weather conditions along routes using Open-Meteo
- **Road Analysis**: Road type, width, and condition assessment using OSMnx
- **Risk Assessment**: Political and social risk analysis via web scraping and sentiment analysis
- **Resilience Scoring**: AI-powered route resilience scoring using Google Gemini
- **Comprehensive Logging**: Detailed logging for debugging and monitoring
- **Error Handling**: Robust error handling with fallback mechanisms

## Project Structure

```
ml_module/
├── config/
│   └── api_keys.py          # API key management
├── routes/
│   ├── google_maps_client.py # Google Maps API client
│   └── fallback_routes.py   # OpenRouteService fallback
├── weather/
│   └── weather_client.py    # Weather data client
├── road_data/
│   └── road_analyzer.py     # Road network analysis
├── risk_analysis/
│   └── political_risk.py    # Political/social risk analysis
├── resilience/
│   └── gemini_scorer.py     # Gemini AI resilience scorer
├── utils/
│   └── logger.py            # Logging utility
└── main.py                  # Main orchestrator
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API Keys

Create a `.env` file in the project root:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key_here
```

**API Key Sources:**
- **Google Maps**: https://console.cloud.google.com/google/maps-apis
  - Enable: Directions API, Places API, Roads API
- **Gemini**: https://makersuite.google.com/app/apikey
- **OpenRouteService**: https://openrouteservice.org/dev/#/signup (free tier available)

### 3. Optional Dependencies

Some features work with fallbacks if optional packages aren't installed:
- `osmnx`: For detailed road network analysis (falls back to estimates)
- `transformers`: For advanced sentiment analysis (falls back to keyword matching)
- `python-dotenv`: For loading `.env` files (falls back to environment variables)

## Usage

### Important: Coordinate-Agnostic Design

**The ML module does NOT perform geocoding.** It is a pure analysis engine that operates only on provided latitude/longitude coordinates.

- ❌ **DO NOT**: Pass city names or addresses to the ML module
- ✅ **DO**: Geocode locations in your backend/API layer, then pass coordinates to the ML module
- ✅ **DO**: Use the `run_analysis()` function with explicit lat/lng parameters

### Basic Usage

```python
from ml_module.run_analysis import run_analysis

# Coordinates must be provided by backend after geocoding user-selected locations
# The ML module does NOT perform geocoding - it only accepts coordinates

origin_lat = 28.644800   # Provided by backend after geocoding
origin_lng = 77.216721   # Provided by backend after geocoding
dest_lat = 28.459496     # Provided by backend after geocoding
dest_lng = 77.029806     # Provided by backend after geocoding

# Define user priorities (weights should sum to ~1.0)
user_priorities = {
    "time": 0.4,
    "distance": 0.3,
    "safety": 0.2,
    "carbon_emission": 0.1
}

# Analyze routes (coordinates only - no geocoding)
result = run_analysis(
    origin_lat=origin_lat,
    origin_lng=origin_lng,
    dest_lat=dest_lat,
    dest_lng=dest_lng,
    origin_name="Delhi",  # Optional: for display/logging only
    dest_name="Gurgaon",  # Optional: for display/logging only
    priorities=user_priorities
)

# Access results
if result.get("resilience_scores"):
    best_route = result["resilience_scores"]["best_route_name"]
    print(f"Best route: {best_route}")
    
    for route in result["resilience_scores"]["routes"]:
        print(f"{route['route_name']}: {route['overall_resilience_score']}/100")
```

### Running the Example

```bash
python ml_module/main.py
```

## Module Details

### Routes Module
- **Google Maps Client**: Primary route provider with Directions, Places, and Roads APIs
- **Fallback Routes**: OpenRouteService integration when Google Maps fails

### Weather Module
- Uses Open-Meteo API (free, no key required)
- Provides rainfall, visibility, windspeed, temperature

### Road Data Module
- Uses OSMnx for road network analysis
- Extracts road types, estimates width, assesses conditions

### Risk Analysis Module
- Web scrapes news for political/social risks
- Uses sentiment analysis (transformers or keyword-based fallback)

### Resilience Module
- Uses Google Gemini AI for intelligent route scoring
- Considers weather, road conditions, risks, and user priorities

## Logging

Logs are written to:
- Console: INFO level and above
- File: `logs/ml_module.log` (DEBUG level and above)

## Error Handling

The system includes comprehensive error handling:
- API failures automatically trigger fallbacks
- Missing API keys use alternative services where possible
- All errors are logged with full stack traces
- Graceful degradation ensures partial results when possible

## Integration with Frontend

The system accepts parameters that can come from a frontend:
- User priorities/weights (carbon emission, time, distance, safety)
- Source and destination coordinates
- Optional location names

Returns structured JSON with:
- Route alternatives with full details
- Resilience scores for each route
- Best route recommendation
- Rankings and reasoning

## Notes

- Google Maps API requires billing enabled (free tier available)
- OpenRouteService has a free tier with rate limits
- Weather API (Open-Meteo) is completely free
- Gemini API has free tier with rate limits
- OSMnx requires internet connection for road data

