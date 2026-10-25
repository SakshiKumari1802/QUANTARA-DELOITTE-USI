import mongoose from "mongoose";

const RecommendedRouteSchema = new mongoose.Schema({
    ml_route_id: String,
    route_name: String,

    source: String,
    destination: String,

    // Route metrics for comparison
    time_minutes: {
        type: Number,
        default: 0
    },
    distance_km: {
        type: Number,
        default: 0
    },
    cost_inr: {
        type: Number,
        default: 0
    },
    carbon_kg: {
        type: Number,
        default: 0
    },

    overview_polyline: String,

    decoded_coordinates: [
        {
            lat: Number,
            lng: Number
        }
    ],

    intermediate_cities: [
        {
            name: String,
            lat: Number,
            lon: Number
        }
    ],

    // Sentiment Analysis Data (for comparison on reroute)
    sentiment_analysis: {
        sentiment_score: {
            type: Number,
            default: 0.5
        },
        risk_factors: {
            type: [String],
            default: []
        },
        positive_factors: {
            type: [String],
            default: []
        },
        reasoning: {
            type: String,
            default: ""
        }
    },

    // Resilience scores for comparison
    resilience_scores: {
        overall: {
            type: Number,
            default: 0
        },
        time: {
            type: Number,
            default: 0
        },
        distance: {
            type: Number,
            default: 0
        },
        carbon: {
            type: Number,
            default: 0
        },
        road_quality: {
            type: Number,
            default: 0
        },
        news_sentiment: {
            type: Number,
            default: 50
        }
    },

    // User priorities used for this analysis
    priorities_used: {
        time: Number,
        distance: Number,
        carbon_emission: Number,
        road_quality: Number
    },

    // News articles that were analyzed (for reroute comparison)
    news_articles_analyzed: [{
        title: String,
        description: String,
        source: String,
        sentiment: String,
        impact: String
    }],

    // Path to generated PDF report (for reroute)
    report_pdf_path: String,

    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model(
    "RecommendedRoute",
    RecommendedRouteSchema
);
