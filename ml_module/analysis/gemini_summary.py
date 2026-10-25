"""
Gemini Route Summary Generator

Uses Google Gemini API to generate natural language summaries, 
creative route names, intermediate city extraction, news sentiment analysis,
and reroute comparison reports - all in a single API call.
"""

import json
import os
import hashlib
import time
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from ..utils.logger import get_logger
from ..config.api_keys import get_gemini_key

CACHE_FILE = os.path.join(os.path.dirname(__file__), "..", "cache", "gemini_cache.json")

logger = get_logger("ml_module.analysis.gemini_summary")


def generate_summary(
    routes_data: List[Dict[str, Any]], 
    overall_context: Dict[str, Any],
    news_articles: Optional[List[Dict[str, Any]]] = None,
    previous_route_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate summaries, extract cities, analyze news sentiment, and optionally
    generate a comparison report with previous route analysis.
    
    All analysis is done in a single API call for efficiency.

    Args:
        routes_data: List of enriched route dictionaries with scores
        overall_context: Context about origin, destination, and priorities
        news_articles: Optional list of news article dicts
        previous_route_data: Optional previous route data for comparison (reroute scenario)

    Returns:
        Dictionary with routes, news_sentiment, and optionally comparison_report
    """
    api_key = get_gemini_key()
    if not api_key:
        logger.error("Gemini API key not found. Skipping summary generation.")
        return {
            "routes": {},
            "news_sentiment": _get_neutral_sentiment("API key not found"),
            "comparison_report": None
        }

    try:
        # --- CACHE CHECK ---
        # --- CACHE CHECK ---
        # FIX 7: Improved cache key to prevent misses from ordering
        news_titles = [n.get("title", "") for n in (news_articles or [])]
        news_hash = hashlib.md5(",".join(sorted(news_titles)).encode()).hexdigest()
        
        # Create a unique hash for the request
        request_signature = {
            "routes": sorted([r.get("route_name", "") for r in routes_data]),
            "scores": sorted([r.get("overall_resilience_score", 0) for r in routes_data]), # ADDED: Invalidate cache if scores change
            "origin": overall_context.get("origin"),
            "destination": overall_context.get("destination"),
            "news_hash": news_hash,
            "is_reroute": previous_route_data is not None
        }
        cache_key = hashlib.md5(json.dumps(request_signature, sort_keys=True).encode()).hexdigest()
        
        # Load cache
        cache_data = {}
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r') as f:
                    cache_data = json.load(f)
            except:
                pass # Ignore cache read errors

        if cache_key in cache_data:
            logger.info("⚡ CACHE HIT: Returning cached Gemini response")
            return cache_data[cache_key]
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        # Prepare routes context for Gemini
        # FIX 5: Hard cap routes sent to Gemini (Top 3 only)
        # LLMs don't need to analyze 8 routes. Top 3 is enough for reasoning.
        sorted_routes = sorted(
            routes_data,
            key=lambda r: r.get("overall_resilience_score", 0),
            reverse=True
        )[:3]

        routes_context = []
        for route in sorted_routes:
            resilience = route.get('overall_resilience_score', 0)
            comp_scores = route.get('component_scores', {})
            weather_risk = route.get('avg_weather_risk', 0)
            safety_score = route.get('road_safety_score', 0.5)
            carbon_score = route.get('carbon_score', 0)
            
            summary_obj = {
                "id": route.get("route_name", "Unknown"),
                "total_distance": route.get("distance_text", "Unknown"),
                "total_time": route.get("duration_text", "Unknown"),
                "scores": {
                    "overall_resilience": resilience,
                    "weather_risk": weather_risk,
                    "road_safety": safety_score,
                    "carbon_efficiency": carbon_score
                },
                # FIX 1: Stop sending coordinates entirely. LLMs infer cities from context/names.
                # "path_sample": route.get("coordinates", [])[::100]  <-- REMOVED
            }
            routes_context.append(summary_obj)

        origin = overall_context.get('origin', 'Origin')
        destination = overall_context.get('destination', 'Destination')
        priorities = overall_context.get('priorities', {})
        
        # Build the combined prompt
        include_news = news_articles and len(news_articles) > 0
        is_reroute = previous_route_data is not None
        
        news_section = ""
        news_output_section = ""
        comparison_section = ""
        comparison_output_section = ""
        
        # News section
        # News section
        if include_news:
            # FIX 3: Shrink news payload to titles ONLY (Top 6)
            articles_context = [a.get("title", "") for a in news_articles[:6]]
            
            news_section = f"""
---
NEWS ARTICLES FOR SENTIMENT ANALYSIS:
The following news articles are related to the transportation corridor from {origin} to {destination}.

{json.dumps(articles_context, separators=(",", ":"))}

TASK B: News Sentiment Analysis
Analyze these news articles to assess their impact on route resilience for logistics/freight transport.

For each article, determine if it is:
- POSITIVE (good for transport - new roads, efficiency improvements, clear weather)
- NEGATIVE (bad for transport - accidents, road closures, traffic jams, bad weather, strikes)
- NEUTRAL (general news with no transport impact)

Provide an overall sentiment_score from 0 to 1:
- 0.0-0.3: Very negative (multiple serious disruptions)
- 0.3-0.5: Somewhat negative (minor issues or concerns)
- 0.5: Neutral (balanced or no significant impact)
- 0.5-0.7: Somewhat positive (minor improvements)
- 0.7-1.0: Very positive (significant improvements to transport)
"""
            news_output_section = """,
    "news_sentiment": {
        "sentiment_score": 0.65,
        "risk_factors": ["road closure on NH-48", "traffic congestion"],
        "positive_factors": ["new expressway opened", "toll efficiency improved"],
        "reasoning": "Brief 1-2 sentence explanation of overall sentiment",
        "article_sentiments": [
            {"title": "Article title...", "sentiment": "positive|negative|neutral", "impact": "Brief impact"}
        ]
    }"""
        
        # Comparison section (for reroute)
        if is_reroute:
            prev_sentiment = previous_route_data.get('sentiment_analysis', {})
            prev_scores = previous_route_data.get('resilience_scores', {})
            prev_priorities = previous_route_data.get('priorities_used', {})
            prev_date = previous_route_data.get('analyzed_at', 'previous analysis')
            prev_name = previous_route_data.get('route_name', 'Unknown')
            
            comparison_section = f"""
---
PREVIOUS ROUTE ANALYSIS (from {prev_date}):
This is a REROUTE scenario. Compare the new analysis with the previous one.

Previous Route: {prev_name}
Previous Sentiment Score: {prev_sentiment.get('sentiment_score', 0.5)}
Previous Risk Factors: {json.dumps(prev_sentiment.get('risk_factors', []))}
Previous Positive Factors: {json.dumps(prev_sentiment.get('positive_factors', []))}
Previous Resilience Score: {prev_scores.get('overall', 0)}
Previous Component Scores:
  - Time: {prev_scores.get('time', 0)}
  - Distance: {prev_scores.get('distance', 0)}
  - Carbon: {prev_scores.get('carbon', 0)}
  - Road Quality: {prev_scores.get('road_quality', 0)}
  - News Sentiment: {prev_scores.get('news_sentiment', 50)}

TASK C: Comparison Report
Compare the NEW route analysis with the PREVIOUS one and generate a comparison report.
CRITICAL: Focus on the "Upsides" of the NEW route and the "Downsides" of the OLD route to justify the reroute.

1. Sentiment Change: Explain how the sentiment has improved (or if it hasn't, why).
2. Risk Comparison: Highlight risks present in the OLD route that are avoided in the NEW route ("Resolved Risks").
3. Tradeoffs: Compare key metrics. If the new route is longer, explain why the safety/resilience gain is worth it.
4. Recommendation: Strongly recommend the new route if it offers better resilience or safety.
"""
            comparison_output_section = """,
    "comparison_report": {
        "summary": "Brief executive summary of what changed",
        "sentiment_change": {
            "direction": "improved|worsened|stable",
            "percentage_change": "+15%",
            "reason": "Why sentiment changed"
        },
        "risk_comparison": {
            "new_risks": ["risks that appeared"],
            "resolved_risks": ["risks that were resolved"],
            "ongoing_risks": ["risks that remain"]
        },
        "tradeoffs": [
            {
                "factor": "Time|Distance|Carbon|Safety|Sentiment",
                "old_value": "previous value",
                "new_value": "current value",
                "change": "+10% or -5 min",
                "assessment": "Brief assessment of this tradeoff"
            }
        ],
        "recommendation": "Based on the analysis, the new route is recommended/not recommended because..."
    }"""

        prompt = f"""
You are a Logistics Analysis Expert. Analyze these supply chain routes from {origin} to {destination}.

Routes Data:
{json.dumps(routes_context, separators=(",", ":"))}

TASK A: Route Analysis
1. Give each route a unique, creative, professional name based on its characteristics (e.g., "The Coastal Expressway", "The Industrial Corridor").
2. Write a 1-sentence 'short_summary' highlighting the key trade-off (e.g., "Fastest route but high weather risk").
3. Write a 'reasoning' paragraph explaining why it got its resilience score.
4. IMPORTANT: Identify exactly 3 major intermediate cities/towns that this route ACTUALLY passes through between {origin} and {destination}. 
   - These MUST be real cities on the route path
   - You MUST provide accurate latitude and longitude coordinates for each city
   - Example: Delhi to Bengaluru route might pass through Jaipur and Hyderabad
{news_section}{comparison_section}
---
Output strictly valid JSON in this format:
{{
    "routes": {{
        "Route 1": {{
            "route_name": "Name",
            "short_summary": "Summary",
            "reasoning": "Reasoning",
            "intermediate_cities": [
                {{"name": "CityName", "lat": 28.6139, "lon": 77.2090}},
                {{"name": "AnotherCity", "lat": 17.3850, "lon": 78.4867}}
            ]
        }}
    }}{news_output_section}{comparison_output_section}
}}
"""


        log_msg = "Sending request to Gemini (summary"
        if include_news:
            log_msg += " + sentiment"
        if is_reroute:
            log_msg += " + comparison"
        log_msg += ")..."
        logger.info(log_msg)
        
        # FIX 6: Token Guard
        # If prompt is huge, disable news/reroute to prevent 429s/crashes
        if len(prompt) > 15000:
            logger.warning(f"Prompt too large ({len(prompt)} chars). Disabling news & comparison to save tokens.")
            # Reconstruct prompt with minimal data
            prompt = f"""
You are a Logistics Analysis Expert. Analyze routes: {origin} to {destination}.
Routes Data: {json.dumps(routes_context, separators=(",", ":"))}
Task: Provide summary, reasoning, names, and intermediate cities.
Output strictly JSON format as defined previously.
"""

        # RATE LIMIT HELPER: Sleep briefly to avoid hitting RPM limits
        time.sleep(2)
        
        response = model.generate_content(prompt)
        
        # Parse JSON from response
        text = response.text
        
        # Clean up code blocks if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        result = json.loads(text.strip())
        
        # Extract routes data
        routes_result = result.get("routes", result)
        if "routes" not in result:
            routes_result = result
            result = {"routes": routes_result}
        
        # Extract news_sentiment
        news_sentiment = result.get("news_sentiment", _get_neutral_sentiment("No news provided"))
        
        if include_news and "news_sentiment" in result:
            sentiment_score = news_sentiment.get("sentiment_score", 0.5)
            sentiment_score = max(0.0, min(1.0, float(sentiment_score)))
            news_sentiment["sentiment_score"] = sentiment_score
            news_sentiment.setdefault("risk_factors", [])
            news_sentiment.setdefault("positive_factors", [])
            news_sentiment.setdefault("reasoning", "Analysis completed")
            news_sentiment.setdefault("article_sentiments", [])
            
            logger.info(f"News sentiment score: {sentiment_score:.2f}")
            logger.info(f"Risk factors: {news_sentiment.get('risk_factors', [])}")
        
        # Extract comparison_report if reroute
        comparison_report = None
        if is_reroute:
            comparison_report = result.get("comparison_report", None)
            if comparison_report:
                logger.info(f"Comparison report generated: {comparison_report.get('summary', 'N/A')[:100]}...")
        
        for route_id, route_data in routes_result.items():
            logger.debug(f"Gemini response for {route_id}: {route_data}")

        logger.info("Successfully generated Gemini analysis")
        
        response_data = {
            "routes": routes_result,
            "news_sentiment": news_sentiment,
            "comparison_report": comparison_report
        }
        
        # --- SAVE TO CACHE ---
        try:
            os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
            cache_data[cache_key] = response_data
            with open(CACHE_FILE, 'w') as f:
                json.dump(cache_data, f, indent=2)
        except Exception as cache_err:
            logger.warning(f"Failed to save to cache: {cache_err}")
            
        return response_data

    except Exception as e:
        logger.error(f"Error generating Gemini summary: {str(e)}")
        return {
            "routes": {},
            "news_sentiment": _get_neutral_sentiment(f"Error: {str(e)}"),
            "comparison_report": None
        }


def _get_neutral_sentiment(reason: str) -> Dict[str, Any]:
    """Return a neutral sentiment result."""
    return {
        "sentiment_score": 0.5,
        "risk_factors": [],
        "positive_factors": [],
        "reasoning": reason,
        "article_sentiments": []
    }
