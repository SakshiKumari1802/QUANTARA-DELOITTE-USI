"""
News Analysis Module

Fetches route-relevant news from TheNewsAPI for cities along a route.
Used to analyze news sentiment for resilience scoring.
"""

import os
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import requests

from ..utils.logger import get_logger
from ..config.api_keys import get_api_key

logger = get_logger("ml_module.analysis.news_analysis")

# API Configuration
NEWS_API_KEY = "NEWS_API_KEY"
NEWS_API_BASE_URL = "https://api.thenewsapi.com/v1/news/all"
CACHE_DURATION_HOURS = 1

# In-memory cache for news data
_news_cache: Dict[str, Dict[str, Any]] = {}


@dataclass
class NewsArticle:
    """Represents a news article from TheNewsAPI."""
    uuid: str
    title: str
    description: str
    url: str
    source: str
    published_at: str
    image_url: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


def get_news_api_key() -> Optional[str]:
    """Get TheNewsAPI key from environment."""
    return get_api_key(NEWS_API_KEY)


def _get_cache_key(cities: List[str]) -> str:
    """Generate a cache key from cities list."""
    return "_".join(sorted([c.lower().strip() for c in cities]))


def _is_cache_valid(cache_entry: Dict[str, Any]) -> bool:
    """Check if a cache entry is still valid."""
    if "timestamp" not in cache_entry:
        return False
    cache_time = datetime.fromisoformat(cache_entry["timestamp"])
    return datetime.now() - cache_time < timedelta(hours=CACHE_DURATION_HOURS)


def fetch_route_news(
    cities: List[str],
    max_articles: int = 10,
    use_cache: bool = True
) -> List[NewsArticle]:
    """
    Fetch logistics/transport news for cities along a route.
    
    Args:
        cities: List of city names along the route
        max_articles: Maximum number of articles to fetch
        use_cache: Whether to use cached results
        
    Returns:
        List of NewsArticle objects
    """
    if not cities:
        logger.warning("No cities provided for news fetch")
        return []
    
    cache_key = _get_cache_key(cities)
    
    # Check cache first
    if use_cache and cache_key in _news_cache:
        cache_entry = _news_cache[cache_key]
        if _is_cache_valid(cache_entry):
            logger.info(f"Using cached news for cities: {cities}")
            return [NewsArticle(**a) for a in cache_entry["articles"]]
    
    # Get API key
    api_key = get_news_api_key()
    if not api_key:
        logger.warning("NEWS_API_KEY not found in environment. Using mock data.")
        return _get_mock_news(cities)
    
    try:
        articles = _fetch_from_api(cities, api_key, max_articles)
        
        # If no results, try broader India search
        if not articles:
            logger.info("No city-specific news found. Trying broader India search...")
            articles = _fetch_india_news(api_key, max_articles)
        
        # If still no results, use mock data
        if not articles:
            logger.info("No news from API. Using mock data for demonstration.")
            articles = _get_mock_news(cities)
        
        # Cache the results
        _news_cache[cache_key] = {
            "timestamp": datetime.now().isoformat(),
            "articles": [a.to_dict() for a in articles]
        }
        
        logger.info(f"Fetched {len(articles)} news articles for route")
        return articles
        
    except Exception as e:
        logger.error(f"Error fetching news: {str(e)}")
        return _get_mock_news(cities)


def _fetch_from_api(
    cities: List[str],
    api_key: str,
    max_articles: int
) -> List[NewsArticle]:
    """Fetch news from TheNewsAPI for specific cities."""
    
    # Calculate date 5 days ago
    published_after = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    
    # Build search query: (City1 | City2) + (logistics keywords)
    city_section = f"({' | '.join([f'\"{c}\"' for c in cities])})"
    keywords = "(logistics | transport | highway | infrastructure | freight | truck | road | accident | diversion | traffic)"
    search_query = f"{city_section} + {keywords}"
    
    logger.info(f"Searching news with query: {search_query[:100]}...")
    
    params = {
        "api_token": api_key,
        "search": search_query,
        "language": "en",
        "limit": max_articles,
        "categories": "business,tech,general",
        "sort": "published_at",
        "published_after": published_after
    }
    
    try:
        response = requests.get(NEWS_API_BASE_URL, params=params, timeout=10)
        
        if response.status_code == 401:
            logger.warning(f"News API unauthorized (401). Key ending in ...{api_key[-5:] if api_key and len(api_key)>5 else '****'} invalid.")
            return []
            
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.warning(f"News API request failed: {e}")
        return []
    articles_data = data.get("data", [])
    
    return [
        NewsArticle(
            uuid=a.get("uuid", ""),
            title=a.get("title", ""),
            description=a.get("description", ""),
            url=a.get("url", ""),
            source=a.get("source", ""),
            published_at=a.get("published_at", ""),
            image_url=a.get("image_url")
        )
        for a in articles_data
    ]


def _fetch_india_news(api_key: str, max_articles: int) -> List[NewsArticle]:
    """Fetch broader India logistics news as fallback."""
    
    published_after = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    
    search_query = "(India) + (logistics | transport | highway | freight | road | traffic)"
    
    params = {
        "api_token": api_key,
        "search": search_query,
        "language": "en",
        "limit": max_articles,
        "categories": "business,tech,general",
        "sort": "published_at",
        "published_after": published_after
    }
    
    response = requests.get(NEWS_API_BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    
    data = response.json()
    articles_data = data.get("data", [])
    
    return [
        NewsArticle(
            uuid=a.get("uuid", ""),
            title=a.get("title", ""),
            description=a.get("description", ""),
            url=a.get("url", ""),
            source=a.get("source", ""),
            published_at=a.get("published_at", ""),
            image_url=a.get("image_url")
        )
        for a in articles_data
    ]


def _get_mock_news(cities: List[str]) -> List[NewsArticle]:
    """Generate mock news data for demonstration purposes."""
    
    city_str = ", ".join(cities[:2]) if cities else "major cities"
    
    mock_articles = [
        NewsArticle(
            uuid="mock-1",
            title=f"Western Corridor Freight Movement Sees 15% Spike Near {city_str}",
            description="Recent data shows increased activity in the industrial corridor.",
            url="https://example.com/freight-movement",
            source="Logistics Weekly",
            published_at=datetime.now().isoformat()
        ),
        NewsArticle(
            uuid="mock-2",
            title="New Smart Toll Plazas Operational on NH-48",
            description="FASTag implementation reaches 98% efficiency reducing wait times.",
            url="https://example.com/toll-plazas",
            source="Transport Today",
            published_at=datetime.now().isoformat()
        ),
        NewsArticle(
            uuid="mock-3",
            title=f"Infrastructure Development Boost for {cities[0] if cities else 'Major City'}",
            description="Government announces new road infrastructure projects.",
            url="https://example.com/infrastructure",
            source="Business Standard",
            published_at=(datetime.now() - timedelta(days=1)).isoformat()
        ),
        NewsArticle(
            uuid="mock-4",
            title="Monsoon Preparedness for Highway Cargo",
            description="Transport associations issue guidelines for safe trucking during rain.",
            url="https://example.com/monsoon-prep",
            source="Transport Times",
            published_at=(datetime.now() - timedelta(days=2)).isoformat()
        )
    ]
    
    return mock_articles


def clear_news_cache() -> None:
    """Clear the in-memory news cache."""
    global _news_cache
    _news_cache = {}
    logger.info("News cache cleared")
