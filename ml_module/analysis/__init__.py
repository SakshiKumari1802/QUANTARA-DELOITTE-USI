"""
Analysis modules for route evaluation.

This package contains specialized analysis modules for different aspects of route evaluation:
- time_analysis: Calculates time scores based on route duration
- distance_analysis: Calculates distance scores based on route length
- carbon_analysis: Calculates carbon emission scores
- road_analysis: Analyzes road quality, types, and weather conditions
- news_analysis: Fetches route-relevant news for sentiment analysis
- gemini_summary: Generates route summaries and news sentiment analysis using Gemini
"""

from .time_analysis import TimeAnalyzer
from .distance_analysis import DistanceAnalyzer
from .carbon_analysis import CarbonAnalyzer
from .road_analysis import RoadAnalyzer
from .news_analysis import fetch_route_news, NewsArticle
from .gemini_summary import generate_summary

__all__ = [
    "TimeAnalyzer",
    "DistanceAnalyzer",
    "CarbonAnalyzer",
    "RoadAnalyzer",
    "fetch_route_news",
    "NewsArticle",
    "generate_summary",
]
