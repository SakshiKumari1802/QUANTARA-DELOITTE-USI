"""
Weather Analysis Module

Analyzes weather conditions along routes and calculates weather-related risks.
Fetches weather data from Open-Meteo API and calculates risk scores.
"""

from typing import List, Dict, Any, Tuple
import requests
from ..utils.logger import get_logger

logger = get_logger("ml_module.analysis.weather")


class WeatherAnalyzer:
    """
    Analyzer for weather conditions and risks along routes.
    
    Samples weather at points along routes and calculates risk metrics.
    """
    
    # Weather risk thresholds
    RAIN_CRITICAL_MM = 50.0  # mm of rainfall
    WIND_CRITICAL_MS = 25.0  # m/s wind speed
    
    # Sample weather every N km
    # WEATHER_SAMPLE_INTERVAL_KM = 50.0
    
    def __init__(self):
        """Initialize the Weather Analyzer."""
        logger.info("WeatherAnalyzer initialized")
        
    def get_weather_at_point(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Get weather data for a specific coordinate point.
        
        Args:
            lat: Latitude
            lon: Longitude
            
        Returns:
            Dictionary with weather data and risk score (0-1)
        """
        weather = self._fetch_weather_open_meteo(lat, lon)
        
        # Calculate single point risk
        visibility_risk = 1.0 - (weather["visibility_m"] / 10000)
        visibility_risk = max(0.0, min(1.0, visibility_risk))
        
        rain_risk = min(1.0, weather["rainfall_mm"] / self.RAIN_CRITICAL_MM)
        wind_risk = min(1.0, weather["windspeed"] / self.WIND_CRITICAL_MS)
        
        avg_risk = (visibility_risk + rain_risk + wind_risk) / 3

        logger.debug(f"Weather risk at ({lat:.4f}, {lon:.4f}): {avg_risk}")
        
        weather["weather_risk_score"] = avg_risk
        weather["visibility_risk"] = visibility_risk
        weather["rain_risk"] = rain_risk
        weather["wind_risk"] = wind_risk
        
        return weather
    
    def _fetch_weather_open_meteo(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Fetch weather data from Open-Meteo API.
        
        Args:
            lat: Latitude
            lon: Longitude
        
        Returns:
            Dictionary with weather data
        """
        try:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,cloudcover,precipitation,windspeed_10m"
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            current = data.get("current", {})
            
            rainfall_mm = current.get("precipitation", 0)
            windspeed = current.get("windspeed_10m", 0)
            temperature = current.get("temperature_2m", 15)
            cloudcover = current.get("cloudcover", 50)
            
            # Calculate visibility
            visibility_m = max(100, 10000 - (windspeed * 100) - (rainfall_mm * 50))
            
            weather = {
                "rainfall_mm": float(rainfall_mm),
                "visibility_m": float(visibility_m),
                "windspeed": float(windspeed),
                "temperature": float(temperature),
                "cloudcover": int(cloudcover)
            }
            
            logger.debug(f"Weather at ({lat:.4f}, {lon:.4f}): rain={rainfall_mm}mm, "
                        f"wind={windspeed}m/s, vis={visibility_m}m")
            
            return weather
            
        except Exception as e:
            logger.warning(f"Failed to fetch weather data: {str(e)}")
            # Return default moderate weather
            return {
                "rainfall_mm": 0.0,
                "visibility_m": 10000.0,
                "windspeed": 5.0,
                "temperature": 20.0,
                "cloudcover": 30
            }
    
    def _create_default_result(self) -> Dict[str, Any]:
        """
        Create default result when analysis fails.
        
        Returns:
            Default weather analysis result
        """
        return {
            "weather_data": [],
            "avg_rainfall": 0.0,
            "avg_windspeed": 5.0,
            "avg_visibility": 10000.0,
            "avg_temperature": 20.0,
            "avg_cloudcover": 30,
            "visibility_risk": 0.0,
            "rain_risk": 0.0,
            "wind_risk": 0.0,
            "avg_weather_risk": 0.0
        }


