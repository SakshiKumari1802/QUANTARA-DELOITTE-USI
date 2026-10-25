"""
API Key Management Module
Loads API keys from environment variables or .env file
"""

import os
from typing import Optional
from pathlib import Path

try:
    from dotenv import load_dotenv
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False


def load_api_keys() -> None:
    """
    Load API keys from .env file if available.
    """
    if DOTENV_AVAILABLE:
        env_path = Path(".env")
        if env_path.exists():
            load_dotenv(env_path)
        else:
            # Try loading from project root
            root_env = Path(__file__).parent.parent.parent / ".env"
            if root_env.exists():
                load_dotenv(root_env)


def get_api_key(key_name: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get an API key from environment variables.
    
    Args:
        key_name: Name of the API key (e.g., 'GOOGLE_MAPS_API_KEY')
        default: Default value if key is not found
    
    Returns:
        API key value or default/None
    """
    load_api_keys()
    return os.getenv(key_name, default)


# API Key Constants
GOOGLE_MAPS_API_KEY = "GOOGLE_MAPS_API_KEY"
GEMINI_API_KEY = "GEMINI_API_KEY"
OPENROUTESERVICE_API_KEY = "OPENROUTESERVICE_API_KEY"
NEWS_API_KEY = "NEWS_API_KEY"


def get_google_maps_key() -> Optional[str]:
    """Get Google Maps API key"""
    return get_api_key(GOOGLE_MAPS_API_KEY)


def get_gemini_key() -> Optional[str]:
    """Get Gemini API key"""
    return get_api_key(GEMINI_API_KEY)


def get_openrouteservice_key() -> Optional[str]:
    """Get OpenRouteService API key"""
    return get_api_key(OPENROUTESERVICE_API_KEY)


def get_news_api_key() -> Optional[str]:
    """Get TheNewsAPI key for news sentiment analysis"""
    return get_api_key(NEWS_API_KEY)
