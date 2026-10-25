import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mongoose from "mongoose";
import RecommendedRoute from "./models/RecommendedRoute.js";
import CoveredPoint from "./models/CoveredPoints.js";
//import { simulateRouteMovement } from "./utils/simulation.js";
import simulateRoute from "../ml_module/utils/simulation.js";
import polyline from "@mapbox/polyline";
import authRoutes from "./routes/auth.routes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (one level up from backend)
const rootEnvPath = path.join(__dirname, "..", ".env");
const backendEnvPath = path.join(__dirname, ".env");

// Try to load from root first, then backend directory
if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
    console.log(`Loaded .env from: ${rootEnvPath}`);
} else if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
    console.log(`Loaded .env from: ${backendEnvPath}`);
} else {
    dotenv.config(); // Default behavior
    console.log("Warning: No .env file found. Using default dotenv behavior.");
}

//MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));


const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);


const GH_KEY = process.env.GH_KEY;

// Debug: Check if GH_KEY is loaded
if (GH_KEY) {
    console.log(`GH_KEY loaded successfully (${GH_KEY.substring(0, 8)}...)`);
} else {
    console.log("WARNING: GH_KEY not found in environment variables!");
    console.log("Please ensure .env file exists with GH_KEY=your_graphhopper_key");
}

// Cache for storing routes (so we don't re-fetch when priorities change)
const routeCache = new Map();

// -----------------------------
// Logging Setup
// -----------------------------
const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "backend.log");

function log(message, level = "INFO") {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    // Console output
    console.log(logMessage);

    // File output
    fs.appendFileSync(logFile, logMessage + "\n", "utf8");
}

// Request logging middleware
app.use((req, res, next) => {
    log(`${req.method} ${req.path} - IP: ${req.ip}`);
    if (req.body && Object.keys(req.body).length > 0) {
        log(`Request body: ${JSON.stringify(req.body).substring(0, 200)}...`);
    }

    next();
});

// -----------------------------
// 🔄 Simulation Loop (using imported simulateRoute from ml_module)
// -----------------------------
// simulateRoute is imported from "../ml_module/utils/simulation.js"

// -----------------------------
// Root endpoint
// -----------------------------
app.get("/", (req, res) => {
    log("Root endpoint accessed");
    res.json({
        message: "B2B Dashboard Backend API - Formula-Based Scoring with Sentiment Analysis",
        version: "2.1.0",
        endpoints: {
            "GET /geocode": "Geocode city name to coordinates",
            "GET /route": "Get route between coordinates (GraphHopper)",
            "POST /analyze-routes": "Analyze routes using ML module (calls Google Maps + full analysis + sentiment)",
            "POST /rescore-routes": "Re-score routes with new priorities (cached data, no API calls)"
        },
        features: [
            "Mathematical formula-based scoring",
            "Time, distance, carbon, and road quality analysis",
            "Weather integration via Open-Meteo",
            "Road type analysis via OSMnx",
            "News sentiment analysis (20% fixed weight)",
            "Route caching for fast priority updates",
            "Route comparison for reroutes"
        ]
    });
});

// -----------------------------
// 🟢 Geocoding (Photon – FREE)
// -----------------------------
app.get("/geocode", async (req, res) => {
    const { city } = req.query;

    log(`=== GEOCODING ===`);
    log(`Request: ${city}`);

    if (!city) {
        log("Geocoding failed: City parameter missing", "ERROR");
        return res.status(400).json({ error: "City required" });
    }

    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(city)}&limit=1`;
        log(`Photon API call: ${url}`);

        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            log(`Result: (${lat}, ${lon})`);
        } else {
            log(`No results for ${city}`, "WARN");
        }

        return res.json(data);
    } catch (err) {
        log(`Geocoding error: ${err.message}`, "ERROR");
        return res.status(500).json({ error: "Geocoding failed" });
    }
});

// -----------------------------
// 🟦 Routing (GraphHopper)
// -----------------------------
app.get("/route", async (req, res) => {
    const { coordinates } = req.query;

    log(`=== GRAPHHOPPER ROUTING ===`);
    log(`Coordinates: ${coordinates}`);

    if (!coordinates) {
        log("Route request failed: Missing coordinates parameter", "ERROR");
        return res.status(400).json({ error: "Missing coordinates parameter" });
    }

    if (!GH_KEY) {
        log("Route request failed: Missing GH_KEY in .env", "ERROR");
        return res.status(500).json({
            error: "Missing GH_KEY in .env",
            details: "Please add GH_KEY=your_graphhopper_api_key to your .env file in the backend directory"
        });
    }

    // Convert "lon,lat" → "lat,lon" because GraphHopper expects lat-first
    const points = coordinates
        .split(";")
        .map(c => {
            const [lon, lat] = c.split(",");
            return `${lat},${lon}`;
        });

    log(`Converted ${points.length} coordinate points`);

    const ghURL =
        `https://graphhopper.com/api/1/route?vehicle=car&locale=en&key=${GH_KEY}` +
        points.map(p => `&point=${p}`).join("");

    log(`GraphHopper request URL: ${ghURL.substring(0, 100)}...`);

    try {
        const response = await fetch(ghURL);
        const data = await response.json();

        if (!response.ok) {
            log(`GraphHopper error: ${JSON.stringify(data)}`, "ERROR");

            // Provide more specific error messages
            let errorMessage = "Routing failed";
            if (data.message) {
                errorMessage = data.message;
            } else if (data.error) {
                errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
            } else if (response.status === 401 || response.status === 403) {
                errorMessage = "Invalid or missing GraphHopper API key. Please check your GH_KEY in .env";
            } else if (response.status === 429) {
                errorMessage = "GraphHopper API rate limit exceeded. Please try again later.";
            }

            return res.status(response.status >= 400 && response.status < 500 ? response.status : 500).json({
                error: errorMessage,
                details: data
            });
        }

        log(`GraphHopper route retrieved successfully`);
        return res.json(data);
    } catch (err) {
        log(`GraphHopper exception: ${err.message}`, "ERROR");
        log(`Stack trace: ${err.stack}`, "ERROR");
        return res.status(500).json({
            error: "Routing failed",
            details: err.message || "Unknown error occurred while fetching route from GraphHopper"
        });
    }
});

// -----------------------------
// 🧠 ML Route Analysis (Full Analysis with Sentiment)
// -----------------------------
app.post("/analyze-routes", async (req, res) => {
    log("=" * 60);
    log("=== FULL ROUTE ANALYSIS REQUEST (WITH SENTIMENT) ===");
    log("=" * 60);

    const { source, destination, priorities, osmnxEnabled } = req.body;

    log(`Source: ${source}`);
    log(`Destination: ${destination}`);
    log(`Priorities: ${JSON.stringify(priorities)}`);
    if (typeof osmnxEnabled === "boolean") {
        log(`OSMnx enabled (from frontend): ${osmnxEnabled}`);
    }

    if (!source || !destination) {
        log("Analysis failed: Source and destination required", "ERROR");
        return res.status(400).json({ error: "Source and destination required" });
    }

    try {
        // Clear previous data for a clean session
        await CoveredPoint.deleteMany({});
        await RecommendedRoute.deleteMany({});
        log("Cleared previous CoveredPoints and RecommendedRoutes");

        // Step 1: Geocode source and destination
        log("\n→ GEOCODING");
        log(`Geocoding source: ${source}...`);
        const sourceGeo = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(source)}&limit=1`);
        const sourceData = await sourceGeo.json();

        log(`Geocoding destination: ${destination}...`);
        const destGeo = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(destination)}&limit=1`);
        const destData = await destGeo.json();

        if (!sourceData.features || sourceData.features.length === 0) {
            log(`Geocoding failed for source: ${source}`, "ERROR");
            return res.status(400).json({ error: `Could not geocode source: ${source}` });
        }
        if (!destData.features || destData.features.length === 0) {
            log(`Geocoding failed for destination: ${destination}`, "ERROR");
            return res.status(400).json({ error: `Could not geocode destination: ${destination}` });
        }

        // Photon returns [lon, lat]
        const [sourceLon, sourceLat] = sourceData.features[0].geometry.coordinates;
        const [destLon, destLat] = destData.features[0].geometry.coordinates;

        log(`✓ Source: ${source} -> (${sourceLat}, ${sourceLon})`);
        log(`✓ Destination: ${destination} -> (${destLat}, ${destLon})`);

        // Step 2: Prepare user priorities
        // News sentiment is FIXED at 20%, user-controllable priorities share remaining 80%
        const userTime = priorities?.time || 25;
        const userDistance = priorities?.distance || 25;
        const userSafety = priorities?.safety || 25;
        const userCarbon = priorities?.carbonEmission || 25;

        // Normalize user priorities to sum to 80% (leaving 20% for news sentiment)
        const userTotal = userTime + userDistance + userSafety + userCarbon;
        const scale = 0.80 / (userTotal / 100);  // Scale factor to make them sum to 80%

        const userPriorities = {
            time: (userTime / 100) * scale,
            distance: (userDistance / 100) * scale,
            carbon_emission: (userCarbon / 100) * scale,
            road_quality: (userSafety / 100) * scale,
            news_sentiment: 0.20  // FIXED at 20%, not user-controllable
        };

        log(`Normalized priorities (80% user + 20% sentiment): ${JSON.stringify(userPriorities)}`);

        // Note: No previous route lookup here - comparison only happens in /reroute
        // This is the first-time analysis, sentiment will be saved for future comparison
        let previousRouteData = null;

        // Step 3: Call Python ML module
        log("\n→ ML MODULE CALL");
        const pythonScript = path.resolve(__dirname, "..", "ml_module", "run_analysis.py");
        log(`Python script: ${pythonScript}`);

        const inputData = JSON.stringify({
            source_lat: sourceLat,
            source_lon: sourceLon,
            dest_lat: destLat,
            dest_lon: destLon,
            source_name: source,
            dest_name: destination,
            priorities: userPriorities,
            osmnx_enabled: typeof osmnxEnabled === "boolean" ? osmnxEnabled : undefined,
            previous_route_data: previousRouteData
        });

        log(`Input data size: ${inputData.length} bytes`);
        log(`Spawning Python process...`);

        const pythonProcess = spawn(`python "${pythonScript}"`, [], {
            cwd: path.join(__dirname, ".."),
            shell: true
        });

        let stdout = "";
        let stderr = "";

        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        pythonProcess.stdout.on("data", (data) => {
            const chunk = data.toString();
            stdout += chunk;
            process.stdout.write(`[PYTHON] ${chunk}`);
        });

        pythonProcess.stderr.on("data", (data) => {
            const chunk = data.toString();
            stderr += chunk;
            process.stderr.write(`[PYTHON ERROR] ${chunk}`);
        });

        pythonProcess.on("close", async (code) => {
            log(`Python process exited with code: ${code}`);

            if (code !== 0) {
                log(`Python error (code ${code}): ${stderr}`, "ERROR");
                return res.status(500).json({
                    error: "ML analysis failed",
                    details: stderr
                });
            }

            try {
                // Parse JSON output from Python
                log("\n→ RESPONSE TRANSFORMATION");
                const lines = stdout.trim().split("\n");
                let jsonLine = "";

                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.startsWith("{")) {
                        jsonLine = lines.slice(i).join("\n");
                        break;
                    }
                }

                if (!jsonLine) {
                    log("No JSON found in Python output", "ERROR");
                    throw new Error("No JSON found in Python output");
                }

                const result = JSON.parse(jsonLine);
                log("✓ JSON parsed successfully");

                if (result.error) {
                    log(`ML module error: ${result.error}`, "ERROR");
                    return res.status(500).json({ error: result.error });
                }

                // Transform ML output to frontend format
                const resilience_scores = result.resilience_scores || {};
                const scoredRoutes = resilience_scores.routes || [];

                log(`Routes received: ${result.routes?.length || 0}`);
                log(`Resilience scores: ${scoredRoutes.length}`);

                const routes = result.routes?.map((route, index) => {
                    const routeName = route.route_name || `Route ${index + 1}`;
                    const scoreData = scoredRoutes.find(r => r.route_name === routeName) || {};

                    // Fallback to route object itself which is enriched, fixing 0 score issue
                    const resilienceScore100 = route.overall_resilience_score || scoreData.overall_resilience_score || 0;
                    const resilienceScore = resilienceScore100 / 10;  // Convert to 0-10 scale

                    let status = "Under Evaluation";
                    if (resilienceScore > 8) {
                        status = "Recommended";
                    } else if (resilienceScore < 6) {
                        status = "Flagged";
                    }

                    const weatherRisk = route.avg_weather_risk || 0;
                    let disruptionRisk = "Low";
                    if (weatherRisk > 0.7) {
                        disruptionRisk = "High";
                    } else if (weatherRisk > 0.4) {
                        disruptionRisk = "Medium";
                    }

                    const durationMin = route.predicted_duration_min || 0;
                    const timeText = durationMin >= 60
                        ? `${Math.round(durationMin / 60)} hrs`
                        : `${Math.round(durationMin)} mins`;

                    const distanceKm = Math.round(route.distance_m / 1000);
                    const distanceText = `${distanceKm} km`;

                    const costPerKm = 15;
                    const cost = Math.round(distanceKm * costPerKm);
                    const costText = `₹${cost.toLocaleString()}`;

                    const carbonKg = route.total_carbon_kg || 0;
                    const carbonText = `${Math.round(carbonKg)} kg CO₂`;

                    // Generate summary and reasoning for frontend
                    const componentScores = route.component_scores || scoreData.component_scores || {};
                    const shortSummary = `Route ${weatherRisk > 0.7 ? 'has high' : 'has moderate'} weather risk. Total distance: ${distanceText}.`;
                    const reasoning = `Time: ${(componentScores.time_score || 0).toFixed(2)}, Distance: ${(componentScores.distance_score || 0).toFixed(2)}, Carbon: ${(componentScores.carbon_score || 0).toFixed(2)}, Road: ${(componentScores.road_quality_score || 0).toFixed(2)}`;

                    // Gemini Output mapping (passed from Python or fallbacks)
                    const geminiAnalysis = route.gemini_analysis || {};
                    const intermediateCities = Array.isArray(geminiAnalysis.intermediate_cities)
                        ? geminiAnalysis.intermediate_cities.slice(0, 2)
                        : [];

                    const geminiOutput = {
                        weather_risk_score: Math.round(geminiAnalysis.weather_risk_score || weatherRisk * 100),
                        road_safety_score: Math.round(geminiAnalysis.road_safety_score || (route.road_safety_score || 0.5) * 100),
                        // Now using Carbon Score instead of risks
                        carbon_score: Math.round(geminiAnalysis.carbon_score || (route.carbon_score || 0) * 100),
                        social_risk_score: 0, // Keeping for backward compatibility if needed, but UI uses carbon
                        traffic_risk_score: 0,
                        news_sentiment_score: Math.round(route.news_sentiment_score || 50),

                        overall_resilience_score: Math.round(geminiAnalysis.overall_resilience_score || resilienceScore100),
                        short_summary: geminiAnalysis.short_summary || shortSummary,
                        reasoning: geminiAnalysis.reasoning || reasoning,
                        intermediate_cities: intermediateCities
                    };

                    return {
                        id: String(index + 1),
                        origin: source,
                        destination: destination,
                        resilienceScore: resilienceScore,
                        status: status,
                        time: timeText,
                        cost: costText,
                        carbonEmission: carbonText,
                        disruptionRisk: disruptionRisk,
                        distance: distanceText,
                        lastUpdated: "Just now",
                        courier: {
                            // Use creative name from Gemini if available
                            name: geminiAnalysis.route_name || routeName,
                            avatar: (geminiAnalysis.route_name || routeName).substring(0, 2).toUpperCase()
                        },
                        isRecommended: resilienceScore > 8,
                        coordinates: {
                            origin: [sourceLat, sourceLon],
                            destination: [destLat, destLon]
                        },
                        overview_polyline: route.overview_polyline || (route.coordinates && route.coordinates.length > 0 ? polyline.encode(route.coordinates) : ""),
                        analysisData: geminiOutput, // Legacy support
                        geminiOutput: geminiOutput,  // New Frontend field
                        intermediate_cities: intermediateCities
                    };
                }) || [];


                log(`Transformed ${routes.length} routes for frontend`);
                log(`Recommended routes (score > 8): ${routes.filter(r => r.resilienceScore > 8).length}`);

                // ===============================
                // SAVE BEST ROUTE + START SIMULATION
                // ===============================
                console.log("🔥 SAVING BEST ROUTE TO DB");

                // Find recommended route OR fallback to the highest scoring one (first one as they are sorted or simply the highest score)
                // Note: transform logic above doesn't sort, so we should find max score if not sorted
                let bestRoute = routes.find(r => r.isRecommended);

                if (!bestRoute) {
                    console.log("⚠️ No route met 'Recommended' threshold (>8). Falling back to highest scoring route.");
                    if (routes.length > 0) {
                        // Find max score
                        bestRoute = routes.reduce((prev, current) => (prev.resilienceScore > current.resilienceScore) ? prev : current);
                        console.log(`✓ Selected fallback route: ${bestRoute.courier.name} (Score: ${bestRoute.resilienceScore})`);
                    }
                }

                if (!bestRoute) {
                    console.warn("⚠️ No routes available to save.");
                } else {

                    const decodedCoordinates = polyline
                        .decode(bestRoute.overview_polyline)
                        .map(([lat, lng]) => ({ lat, lng }));

                    // Get the original ML route data for sentiment info
                    const mlRouteData = result.routes?.find(r =>
                        r.route_name === bestRoute.courier.name ||
                        r.gemini_analysis?.route_name === bestRoute.courier.name
                    ) || {};

                    // Extract time in minutes from bestRoute.time (e.g., "1064 mins" or "17 hrs")
                    let timeMinutes = 0;
                    if (bestRoute.time) {
                        const hrsMatch = bestRoute.time.match(/(\d+)\s*hrs?/);
                        const minsMatch = bestRoute.time.match(/(\d+)\s*mins?/);
                        if (hrsMatch) timeMinutes += parseInt(hrsMatch[1]) * 60;
                        if (minsMatch) timeMinutes += parseInt(minsMatch[1]);
                    }

                    // Extract distance in km from bestRoute.distance (e.g., "1076 km")
                    let distanceKm = 0;
                    if (bestRoute.distance) {
                        const kmMatch = bestRoute.distance.match(/(\d+)\s*km/);
                        if (kmMatch) distanceKm = parseInt(kmMatch[1]);
                    }

                    // Extract cost from bestRoute.cost (e.g., "₹16,138")
                    let costInr = 0;
                    if (bestRoute.cost) {
                        const costMatch = bestRoute.cost.replace(/[₹,]/g, '').match(/(\d+)/);
                        if (costMatch) costInr = parseInt(costMatch[1]);
                    }

                    // Extract carbon from bestRoute.carbonEmission (e.g., "123 kg CO₂")
                    let carbonKg = 0;
                    if (bestRoute.carbonEmission) {
                        const carbonMatch = bestRoute.carbonEmission.match(/(\d+)/);
                        if (carbonMatch) carbonKg = parseInt(carbonMatch[1]);
                    }

                    // Get risk_factors from news_sentiment_analysis or gemini_analysis
                    const sentimentData = mlRouteData.news_sentiment_analysis || {};
                    const riskFactors = sentimentData.risk_factors ||
                        mlRouteData.gemini_analysis?.risk_factors ||
                        [];

                    const savedRoute = await RecommendedRoute.create({
                        ml_route_id: bestRoute.id,
                        route_name: bestRoute.courier.name,

                        source,
                        destination,

                        // Store route metrics for comparison
                        time_minutes: timeMinutes,
                        distance_km: distanceKm,
                        cost_inr: costInr,
                        carbon_kg: carbonKg,

                        overview_polyline: bestRoute.overview_polyline,
                        decoded_coordinates: decodedCoordinates,

                        intermediate_cities: bestRoute.intermediate_cities,

                        // Store sentiment analysis for future comparison
                        sentiment_analysis: {
                            sentiment_score: sentimentData.sentiment_score || 0.5,
                            risk_factors: riskFactors,
                            positive_factors: sentimentData.positive_factors || [],
                            reasoning: sentimentData.reasoning || "No news analyzed"
                        },

                        // Store resilience scores for comparison
                        resilience_scores: {
                            overall: bestRoute.resilienceScore * 10,
                            time: bestRoute.geminiOutput?.time_score || 0,
                            distance: bestRoute.geminiOutput?.distance_score || 0,
                            carbon: bestRoute.geminiOutput?.carbon_score || 0,
                            road_quality: bestRoute.geminiOutput?.road_safety_score || 0,
                            news_sentiment: bestRoute.geminiOutput?.news_sentiment_score || 50
                        },

                        // Store priorities used
                        priorities_used: {
                            time: userPriorities.time,
                            distance: userPriorities.distance,
                            carbon_emission: userPriorities.carbon_emission,
                            road_quality: userPriorities.road_quality
                        }
                    });

                    // Use the unique MongoDB _id as the route identifier for simulation
                    // This ensures points don't mix across different sessions
                    const routeForSimulation = {
                        ...savedRoute.toObject(),
                        ml_route_id: savedRoute._id.toString()  // Unique per session
                    };

                    console.log("🚀 STARTING SIMULATION with unique ID:", routeForSimulation.ml_route_id);
                    simulateRoute(routeForSimulation).catch(console.error);

                    // Add the unique database ID to the best route for frontend use
                    bestRoute.dbRouteId = savedRoute._id.toString();
                }

                // Cache routes for re-scoring
                const cacheKey = `${source}_${destination}`;
                routeCache.set(cacheKey, {
                    routes: result.routes,
                    source,
                    destination,
                    coordinates: { origin: [sourceLat, sourceLon], destination: [destLat, destLon] }
                });
                log(`✓ Cached routes for ${cacheKey}`);

                log("=" * 60);
                log("=== ROUTE ANALYSIS COMPLETE ===");
                if (result.is_reroute) {
                    log("=== REROUTE - COMPARISON REPORT INCLUDED ===");
                }
                log("=" * 60);

                res.json({
                    routes: routes,
                    bestRoute: result.best_route,
                    analysisComplete: result.analysis_complete,
                    comparisonReport: result.comparison_report || null,
                    isReroute: result.is_reroute || false
                });

            } catch (parseError) {
                log(`Parse error: ${parseError.message}`, "ERROR");
                return res.status(500).json({
                    error: "Failed to parse ML results",
                    details: parseError.message
                });
            }
        });

    } catch (err) {
        log(`Route analysis error: ${err.message}`, "ERROR");
        log(`Stack: ${err.stack}`, "ERROR");
        return res.status(500).json({ error: "Route analysis failed", details: err.message });
    }
});

// -----------------------------
// 🔄 Re-score Routes (Only Resilience Calculation)
// -----------------------------
app.post("/rescore-routes", async (req, res) => {
    log("=" * 60);
    log("=== RE-SCORING REQUEST ===");
    log("=" * 60);

    const { source, destination, priorities } = req.body;

    log(`Source: ${source}`);
    log(`Destination: ${destination}`);
    log(`New priorities: ${JSON.stringify(priorities)}`);

    if (!source || !destination) {
        log("Re-scoring failed: Source and destination required", "ERROR");
        return res.status(400).json({ error: "Source and destination required" });
    }

    const cacheKey = `${source}_${destination}`;
    const cached = routeCache.get(cacheKey);

    if (!cached) {
        log("Re-scoring failed: No cached routes found", "ERROR");
        return res.status(400).json({
            error: "No routes found. Please select source and destination first."
        });
    }

    try {
        // News sentiment is FIXED at 20%, user-controllable priorities share remaining 80%
        const userTime = priorities?.time || 25;
        const userDistance = priorities?.distance || 25;
        const userSafety = priorities?.safety || 25;
        const userCarbon = priorities?.carbonEmission || 25;

        // Normalize user priorities to sum to 80% (leaving 20% for news sentiment)
        const userTotal = userTime + userDistance + userSafety + userCarbon;
        const scale = 0.80 / (userTotal / 100);

        const userPriorities = {
            time: (userTime / 100) * scale,
            distance: (userDistance / 100) * scale,
            carbon_emission: (userCarbon / 100) * scale,
            road_quality: (userSafety / 100) * scale,
            news_sentiment: 0.20  // FIXED at 20%, not user-controllable
        };

        log(`Normalized priorities (80% user + 20% sentiment): ${JSON.stringify(userPriorities)}`);
        log(`Using cached routes (${cached.routes.length} routes)`);

        log("\n→ ML MODULE CALL (rescore only)");
        const pythonScript = path.resolve(__dirname, "..", "ml_module", "rescore_routes.py");
        log(`Python script: ${pythonScript}`);

        const inputData = JSON.stringify({
            routes_data: cached.routes,
            priorities: userPriorities
        });

        log(`Input data size: ${inputData.length} bytes`);

        const pythonProcess = spawn(`python "${pythonScript}"`, [], {
            cwd: path.join(__dirname, ".."),
            shell: true
        });

        let stdout = "";
        let stderr = "";

        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        pythonProcess.stdout.on("data", (data) => {
            const chunk = data.toString();
            stdout += chunk;
            process.stdout.write(`[PYTHON] ${chunk}`);
        });

        pythonProcess.stderr.on("data", (data) => {
            const chunk = data.toString();
            stderr += chunk;
            process.stderr.write(`[PYTHON ERROR] ${chunk}`);
        });

        pythonProcess.on("close", async (code) => {
            log(`Python process exited with code: ${code}`);

            if (code !== 0) {
                log(`Python error (code ${code}): ${stderr}`, "ERROR");
                return res.status(500).json({
                    error: "Re-scoring failed",
                    details: stderr
                });
            }

            try {
                const lines = stdout.trim().split("\n");
                let jsonLine = "";

                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.startsWith("{")) {
                        jsonLine = lines.slice(i).join("\n");
                        break;
                    }
                }

                if (!jsonLine) {
                    log("No JSON found in Python output", "ERROR");
                    throw new Error("No JSON found in Python output");
                }

                const result = JSON.parse(jsonLine);
                log("✓ JSON parsed successfully");

                if (result.error) {
                    log(`Re-scoring error: ${result.error}`, "ERROR");
                    return res.status(500).json({ error: result.error });
                }

                const resilience_scores = result.resilience_scores || {};
                const scoredRoutes = resilience_scores.routes || [];

                const routes = result.routes?.map((route, index) => {
                    const routeName = route.route_name || `Route ${index + 1}`;
                    const scoreData = scoredRoutes.find(r => r.route_name === routeName) || {};

                    // Fallback to route object itself which is enriched, fixing 0 score issue
                    const resilienceScore100 = route.overall_resilience_score || scoreData.overall_resilience_score || 0;
                    const resilienceScore = resilienceScore100 / 10;

                    let status = "Under Evaluation";
                    if (resilienceScore > 8) status = "Recommended";
                    else if (resilienceScore < 6) status = "Flagged";

                    const weatherRisk = route.avg_weather_risk || 0;
                    let disruptionRisk = "Low";
                    if (weatherRisk > 0.7) disruptionRisk = "High";
                    else if (weatherRisk > 0.4) disruptionRisk = "Medium";

                    const durationMin = route.predicted_duration_min || 0;
                    const timeText = durationMin >= 60
                        ? `${Math.round(durationMin / 60)} hrs`
                        : `${Math.round(durationMin)} mins`;

                    const distanceKm = Math.round(route.distance_m / 1000);
                    const distanceText = `${distanceKm} km`;
                    const costPerKm = 15;
                    const cost = Math.round(distanceKm * costPerKm);
                    const costText = `₹${cost.toLocaleString()}`;
                    const carbonKg = route.total_carbon_kg || 0;
                    const carbonText = `${Math.round(carbonKg)} kg CO₂`;

                    const componentScores = route.component_scores || scoreData.component_scores || {};
                    const shortSummary = `Route ${weatherRisk > 0.7 ? 'has high' : 'has moderate'} weather risk. Total distance: ${distanceText}.`;
                    const reasoning = `Time: ${(componentScores.time_score || 0).toFixed(2)}, Distance: ${(componentScores.distance_score || 0).toFixed(2)}, Carbon: ${(componentScores.carbon_score || 0).toFixed(2)}, Road: ${(componentScores.road_quality_score || 0).toFixed(2)}`;

                    // Gemini Output mapping (passed from Python or fallbacks)
                    const geminiAnalysis = route.gemini_analysis || {};
                    const intermediateCities =
                        Array.isArray(geminiAnalysis.intermediate_cities)
                            ? geminiAnalysis.intermediate_cities.slice(0, 2) // limit to 2
                            : [];
                    const geminiOutput = {
                        weather_risk_score: Math.round(geminiAnalysis.weather_risk_score || weatherRisk * 100),
                        road_safety_score: Math.round(geminiAnalysis.road_safety_score || (route.road_safety_score || 0.5) * 100),
                        carbon_score: Math.round(geminiAnalysis.carbon_score || (route.carbon_score || 0) * 100),
                        social_risk_score: 0,
                        traffic_risk_score: 0,
                        news_sentiment_score: Math.round(route.news_sentiment_score || 50),

                        overall_resilience_score: Math.round(geminiAnalysis.overall_resilience_score || resilienceScore100),
                        short_summary: geminiAnalysis.short_summary || shortSummary,
                        reasoning: geminiAnalysis.reasoning || reasoning,
                        intermediate_cities: intermediateCities
                    };

                    return {
                        id: String(index + 1),
                        origin: source,
                        destination: destination,
                        resilienceScore: resilienceScore,
                        status: status,
                        time: timeText,
                        cost: costText,
                        carbonEmission: carbonText,
                        disruptionRisk: disruptionRisk,
                        distance: distanceText,
                        lastUpdated: "Just now",
                        courier: {
                            // Use creative name from Gemini if available
                            name: geminiAnalysis.route_name || routeName,
                            avatar: (geminiAnalysis.route_name || routeName).substring(0, 2).toUpperCase()
                        },
                        isRecommended: resilienceScore > 8,
                        coordinates: cached.coordinates,
                        overview_polyline: route.overview_polyline || (route.coordinates && route.coordinates.length > 0 ? polyline.encode(route.coordinates) : ""),
                        analysisData: geminiOutput, // Legacy support
                        geminiOutput: geminiOutput,  // New Frontend field
                        intermediate_cities: intermediateCities
                    };
                }) || [];

                log(`Re-scored ${routes.length} routes`);
                log(`Recommended routes (score > 8): ${routes.filter(r => r.resilienceScore > 8).length}`);

                // ⚠️ IMPORTANT: Save best route and start simulation AFTER routes are defined
                console.log("🔥 SAVING BEST ROUTE TO DB");

                const bestRoute = routes.find(r => r.isRecommended);

                if (!bestRoute) {
                    console.warn("⚠️ No recommended route found");
                } else {
                    const decodedCoordinates = polyline
                        .decode(bestRoute.overview_polyline)
                        .map(([lat, lng]) => ({ lat, lng }));

                    const savedRoute = await RecommendedRoute.create({
                        ml_route_id: bestRoute.id,
                        route_name: bestRoute.courier.name,
                        source,
                        destination,
                        overview_polyline: bestRoute.overview_polyline,
                        decoded_coordinates: decodedCoordinates,
                        intermediate_cities: bestRoute.intermediate_cities
                    });

                    console.log("🚀 STARTING SIMULATION");
                    simulateRoute(savedRoute).catch(console.error);
                }

                log("=" * 60);
                log("=== RE-SCORING COMPLETE ===");
                log("=" * 60);

                res.json({
                    routes: routes,
                    // Using route info if best_route_name matches none in resilience_scores
                    bestRoute: resilience_scores.best_route_name,
                    analysisComplete: true
                });

            } catch (parseError) {
                log(`Parse error: ${parseError.message}`, "ERROR");
                return res.status(500).json({
                    error: "Failed to parse re-scoring results",
                    details: parseError.message
                });
            }
        });

    } catch (err) {
        log(`Re-scoring error: ${err.message}`, "ERROR");
        return res.status(500).json({ error: "Re-scoring failed", details: err.message });
    }
});

// -----------------------------
// 📍 Record Simulation Point
// -----------------------------
app.post("/record-point", async (req, res) => {
    const { routeId, lat, lon, sequence, isIntermediate, source, destination, routeName } = req.body;

    // log(`Recording point: ${lat}, ${lon} (Seq: ${sequence})`);

    try {
        await CoveredPoint.create({
            mlRouteId: routeId,
            routeName: routeName,
            source,
            destination,
            lat,
            lon,
            isIntermediate,
            coveredAt: new Date()
        });

        res.json({ success: true });
    } catch (err) {
        log(`Error recording point: ${err.message}`, "ERROR");
        res.status(500).json({ error: "Failed to record point" });
    }
});

app.get("/covered-points/:routeId", async (req, res) => {
    try {
        const { routeId } = req.params;
        // Sort by sequence to ensure correct path ordering
        const points = await CoveredPoint.find({ mlRouteId: routeId }).sort({ sequence: 1 });

        // Return array of [lat, lon]
        const coordinates = points.map(p => [p.lat, p.lon]);
        res.json(coordinates);
    } catch (err) {
        log(`Error fetching covered points: ${err.message}`, "ERROR");
        res.status(500).json({ error: "Failed to fetch points" });
    }
});

// -----------------------------
// 🔀 Reroute Calculation
// -----------------------------
app.post("/reroute", async (req, res) => {
    log("=" * 60);
    log("=== REROUTE REQUEST ===");
    log("=" * 60);

    const {
        currentLocation,
        destination,
        excludeRouteId,
        excludeRouteName,
        sourceName,
        originalTripSource,
        originalTripDestination,
        originalRouteName,
        // Original route metrics for fallback (passed from frontend)
        originalRouteTime,
        originalRouteDistance,
        originalRouteCost,
        originalRouteCarbonEmission,
        originalRouteResilienceScore,
        originalRiskFactors,
        // Traversed path metrics (calculated on frontend)
        traversedMetrics
    } = req.body;

    log(`Current Location: ${JSON.stringify(currentLocation)}`);
    log(`Destination: ${destination}`);
    log(`Exclude Route ID: ${excludeRouteId}`);
    log(`Exclude Route Name: ${excludeRouteName}`);
    log(`Source Name (for reroute): ${sourceName}`);
    log(`Original Trip: ${originalTripSource} -> ${originalTripDestination}`);
    log(`Original Route Metrics: Time=${originalRouteTime}, Distance=${originalRouteDistance}, Cost=${originalRouteCost}`);

    if (!currentLocation || !destination) {
        return res.status(400).json({ error: "Current location and destination required" });
    }

    try {
        // Step 1: Geocode Destination (Source is already lat/lon)
        const destGeo = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(destination)}&limit=1`);
        const destData = await destGeo.json();

        if (!destData.features || destData.features.length === 0) {
            return res.status(400).json({ error: `Could not geocode destination: ${destination}` });
        }

        const [destLon, destLat] = destData.features[0].geometry.coordinates;
        log(`✓ Destination: ${destination} -> (${destLat}, ${destLon})`);

        // Step 2: Fetch previous route from MongoDB for comparison (Task C)
        log("\n→ FETCHING PREVIOUS ROUTE FOR COMPARISON");
        let previousRouteData = null;
        let originalRouteDoc = null;

        try {
            log(`Searching for original route: originalRouteName='${originalRouteName}', excludeRouteName='${excludeRouteName}', destination='${destination}'`);

            // First, try to find by excludeRouteName (this is the courier name like "The Green Mega-Corridor")
            if (excludeRouteName) {
                originalRouteDoc = await RecommendedRoute.findOne({
                    route_name: excludeRouteName
                }).sort({ createdAt: -1 });

                if (originalRouteDoc) {
                    log(`✓ Found original route by excludeRouteName: ${originalRouteDoc.route_name}`);
                }
            }

            // Second, try by originalRouteName
            if (!originalRouteDoc && originalRouteName) {
                originalRouteDoc = await RecommendedRoute.findOne({
                    route_name: originalRouteName
                }).sort({ createdAt: -1 });

                if (originalRouteDoc) {
                    log(`✓ Found original route by originalRouteName: ${originalRouteDoc.route_name}`);
                }
            }

            // Third fallback: Search by source + destination combination
            if (!originalRouteDoc && originalTripSource && originalTripDestination) {
                originalRouteDoc = await RecommendedRoute.findOne({
                    source: { $regex: new RegExp(`^${originalTripSource}$`, 'i') },
                    destination: { $regex: new RegExp(`^${originalTripDestination}$`, 'i') }
                }).sort({ createdAt: -1 });

                if (originalRouteDoc) {
                    log(`✓ Found original route by source+destination: ${originalRouteDoc.route_name}`);
                }
            }

            // Fourth fallback: Search by destination only
            if (!originalRouteDoc) {
                originalRouteDoc = await RecommendedRoute.findOne({
                    destination: { $regex: new RegExp(`^${destination}$`, 'i') }
                }).sort({ createdAt: -1 });

                if (originalRouteDoc) {
                    log(`✓ Found original route by destination: ${originalRouteDoc.route_name}`);
                }
            }

            if (originalRouteDoc) {
                log(`Found original route: ${originalRouteDoc.route_name} (from ${originalRouteDoc.createdAt})`);
                log(`  - Sentiment analysis: ${JSON.stringify(originalRouteDoc.sentiment_analysis?.risk_factors || [])}`);
                previousRouteData = {
                    route_name: originalRouteDoc.route_name,
                    sentiment_analysis: originalRouteDoc.sentiment_analysis || {},
                    resilience_scores: originalRouteDoc.resilience_scores || {},
                    priorities_used: originalRouteDoc.priorities_used || {},
                    analyzed_at: originalRouteDoc.createdAt,
                    source: originalRouteDoc.source,
                    destination: originalRouteDoc.destination
                };
            } else {
                log("✗ No previous route found in database - will construct from current session");
                // Log what's actually in the database for debugging
                const allRoutes = await RecommendedRoute.find({}).select('route_name source destination').limit(5);
                log(`  Database has ${allRoutes.length} routes: ${allRoutes.map(r => r.route_name).join(', ')}`);
            }
        } catch (dbErr) {
            log(`Warning: Could not fetch previous route: ${dbErr.message}`, "WARN");
        }

        // Step 3: Call ML Module for New Routes with previous route data
        const userPriorities = {
            time: 0.24,
            distance: 0.16,
            carbon_emission: 0.16,
            road_quality: 0.24,
            news_sentiment: 0.20
        };

        const pythonScript = path.resolve(__dirname, "..", "ml_module", "run_analysis.py");
        log(`Python script: ${pythonScript}`);

        const inputData = JSON.stringify({
            source_lat: currentLocation.lat,
            source_lon: currentLocation.lon,
            dest_lat: destLat,
            dest_lon: destLon,
            source_name: sourceName || "Current Location",
            dest_name: destination,
            priorities: userPriorities,
            previous_route_data: previousRouteData  // Pass for Task C comparison
        });

        const pythonProcess = spawn(`python "${pythonScript}"`, [], {
            cwd: path.join(__dirname, ".."),
            shell: true
        });

        let stdout = "";
        let stderr = "";

        pythonProcess.stdin.write(inputData);
        pythonProcess.stdin.end();

        pythonProcess.stdout.on("data", (data) => { stdout += data.toString(); });
        pythonProcess.stderr.on("data", (data) => { stderr += data.toString(); });

        pythonProcess.on("close", async (code) => {
            if (code !== 0) {
                log(`Reroute Python error: ${stderr}`, "ERROR");
                return res.status(500).json({ error: "Reroute analysis failed" });
            }

            try {
                // Determine Start of JSON
                const lines = stdout.trim().split("\n");
                let jsonLine = "";
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim().startsWith("{")) {
                        jsonLine = lines.slice(i).join("\n");
                        break;
                    }
                }

                if (!jsonLine) throw new Error("No JSON in Python output");

                const result = JSON.parse(jsonLine);
                const scoredRoutes = result.resilience_scores?.routes || [];
                const comparisonReport = result.comparison_report || null;

                if (comparisonReport) {
                    log(`Comparison report generated: ${comparisonReport.summary?.substring(0, 80)}...`);
                }

                // Transform Routes
                const routes = result.routes?.map((route, index) => {
                    const routeName = route.route_name || `Alt Route ${index + 1}`;
                    const scoreData = scoredRoutes.find(r => r.route_name === routeName) || {};

                    const resilienceScore = (route.overall_resilience_score || scoreData.overall_resilience_score || 0) / 10;

                    // Add traversed metrics to get Total Journey metrics
                    const tm = traversedMetrics || { distanceKm: 0, timeMinutes: 0, costInr: 0, carbonKg: 0 };

                    const totalTimeMins = Math.round((route.predicted_duration_min || 0) + (tm.timeMinutes || 0));
                    const totalDistanceKm = Math.round((route.distance_m / 1000) + (tm.distanceKm || 0));

                    // Cost calculation: Base cost (approx 15 INR/km) + Traversed Cost
                    const routeCost = Math.round((route.distance_m / 1000) * 15);
                    const totalCost = Math.round(routeCost + (tm.costInr || 0));

                    const totalCarbon = Math.round((route.total_carbon_kg || 0) + (tm.carbonKg || 0));

                    return {
                        id: `reroute_${index + 1}`,
                        origin: sourceName || "Current Location",
                        destination: destination,
                        resilienceScore: resilienceScore,
                        status: resilienceScore > 8 ? "Recommended" : "Valid",
                        time: `${totalTimeMins} mins`,
                        cost: `₹${totalCost.toLocaleString()}`,
                        carbonEmission: `${totalCarbon} kg CO₂`,
                        disruptionRisk: (route.avg_weather_risk || 0) > 0.5 ? "Medium" : "Low",
                        distance: `${totalDistanceKm} km`,
                        courier: {
                            name: route.gemini_analysis?.route_name || routeName,
                            avatar: "AR"
                        },
                        overview_polyline: route.overview_polyline,
                        coordinates: {
                            origin: [currentLocation.lat, currentLocation.lon],
                            destination: [destLat, destLon]
                        },
                        intermediate_cities: route.gemini_analysis?.intermediate_cities || [],
                        news_sentiment_analysis: route.news_sentiment_analysis || null
                    };
                }) || [];

                // Filter out routes: Remove the first route if it appears to be the same direction
                // Since we're starting from an intermediate point, the first ML route might be similar to original
                // Better approach: Remove any route where courier.name matches excludeRouteName OR
                // has very similar resilience score to avoid duplicates
                let filteredRoutes = routes;

                if (excludeRouteName) {
                    // First, try exact name match
                    const nameFiltered = routes.filter(r => r.courier.name !== excludeRouteName);

                    if (nameFiltered.length === routes.length && routes.length > 1) {
                        log(`No route matched excludeRouteName '${excludeRouteName}', checking for similarity...`);

                        // Check if the first route is effectively the same as the original based on metrics
                        const firstRoute = routes[0];

                        // Heuristic: If time and distance are very close (within 5%), assume it's the same route
                        // Parse numbers from strings like "1234 mins" or "100 km"
                        const parseMetric = (str) => {
                            if (!str) return 0;
                            const match = str.match(/(\d+)/);
                            return match ? parseInt(match[1]) : 0;
                        };

                        const firstTime = parseMetric(firstRoute.time);
                        const firstDist = parseMetric(firstRoute.distance);

                        // Calculate total original metrics (Traversed + Remaining Original)
                        // originalRouteTime e.g. "21 hrs"
                        let origTimeMinutes = 0;
                        if (originalRouteTime) {
                            const hrs = originalRouteTime.match(/(\d+)\s*hrs/);
                            const mins = originalRouteTime.match(/(\d+)\s*min/);
                            if (hrs) origTimeMinutes += parseInt(hrs[1]) * 60;
                            if (mins) origTimeMinutes += parseInt(mins[1]);
                        }

                        const origDistKm = parseMetric(originalRouteDistance);

                        // Compare firstRoute (Total Journey) with Original Route (Total Journey)
                        // Note: firstRoute.time includes traversedMetrics.timeMinutes

                        const timeDiff = Math.abs(firstTime - origTimeMinutes);
                        const distDiff = Math.abs(firstDist - origDistKm);

                        const isTimeSimilar = origTimeMinutes > 0 && timeDiff < (origTimeMinutes * 0.05); // 5% tolerance, avoid division by zero
                        const isDistSimilar = origDistKm > 0 && distDiff < (origDistKm * 0.05);

                        if (isTimeSimilar && isDistSimilar) {
                            log(`First route is similar to original (Time diff: ${timeDiff}m, Dist diff: ${distDiff}km). Skipping.`);
                            filteredRoutes = routes.slice(1);
                        } else {
                            log("First route appears distinct enough from original. Keeping.");
                            // If purely name filtering failed but metrics differ, we might want to keep it
                            // OR we default to skipping first if we really want to force alternatives?
                            // Let's default to skipping if we are unsure, to allow "Alternative" feeling
                            log("Defaulting to skip first route to ensure alternative is offered.");
                            filteredRoutes = routes.slice(1);

                            // However, if skipping leaves us with 0 routes, fallback to keeping all
                            if (filteredRoutes.length === 0) {
                                log("Skipping resulted in 0 routes, reverting to all routes.");
                                filteredRoutes = routes;
                            }
                        }
                    } else {
                        filteredRoutes = nameFiltered;
                    }
                }

                log(`Returning ${filteredRoutes.length} routes (after exclusion)`);

                // Prepare response with comparison report
                // If no originalRouteDoc from DB, construct a fallback from the excludeRouteName info
                let originalRouteInfo;

                if (originalRouteDoc) {
                    // Format time from minutes
                    const timeMinutes = originalRouteDoc.time_minutes || 0;
                    const timeText = timeMinutes >= 60
                        ? `${Math.floor(timeMinutes / 60)} hrs ${timeMinutes % 60} mins`
                        : `${timeMinutes} mins`;

                    // Format distance
                    const distanceKm = originalRouteDoc.distance_km || 0;
                    const distanceText = `${distanceKm} km`;

                    // Format cost
                    const costInr = originalRouteDoc.cost_inr || 0;
                    const costText = `₹${costInr.toLocaleString()}`;

                    // Format carbon
                    const carbonKg = originalRouteDoc.carbon_kg || 0;
                    const carbonText = `${carbonKg} kg CO₂`;

                    originalRouteInfo = {
                        route_name: originalRouteDoc.route_name,
                        source: originalRouteDoc.source,
                        destination: originalRouteDoc.destination,
                        sentiment_analysis: originalRouteDoc.sentiment_analysis,
                        resilience_scores: originalRouteDoc.resilience_scores,
                        // Add formatted route metrics
                        time: timeText,
                        distance: distanceText,
                        cost: costText,
                        carbon: carbonText,
                        // Also include raw values for calculations
                        time_minutes: timeMinutes,
                        distance_km: distanceKm,
                        cost_inr: costInr,
                        carbon_kg: carbonKg
                    };

                    log(`Original route metrics: Time=${timeText}, Distance=${distanceText}, Cost=${costText}`);
                } else {
                    // Fallback: Use info from the request (current session data from frontend)
                    // Parse time to get minutes
                    let origTimeMinutes = 0;
                    if (originalRouteTime) {
                        const hrsMatch = originalRouteTime.match(/(\d+)\s*hrs?/);
                        const minsMatch = originalRouteTime.match(/(\d+)\s*mins?/);
                        if (hrsMatch) origTimeMinutes += parseInt(hrsMatch[1]) * 60;
                        if (minsMatch) origTimeMinutes += parseInt(minsMatch[1]);
                    }

                    // Parse distance to get km
                    let origDistanceKm = 0;
                    if (originalRouteDistance) {
                        const kmMatch = originalRouteDistance.match(/(\d+)/);
                        if (kmMatch) origDistanceKm = parseInt(kmMatch[1]);
                    }

                    // Parse cost to get INR
                    let origCostInr = 0;
                    if (originalRouteCost) {
                        const costMatch = originalRouteCost.replace(/[₹,]/g, '').match(/(\d+)/);
                        if (costMatch) origCostInr = parseInt(costMatch[1]);
                    }

                    // Parse carbon to get kg
                    let origCarbonKg = 0;
                    if (originalRouteCarbonEmission) {
                        const carbonMatch = originalRouteCarbonEmission.match(/(\d+)/);
                        if (carbonMatch) origCarbonKg = parseInt(carbonMatch[1]);
                    }

                    originalRouteInfo = {
                        route_name: originalRouteName || excludeRouteName || "Original Route",
                        source: originalTripSource || "Origin",
                        destination: originalTripDestination || destination,
                        sentiment_analysis: {
                            sentiment_score: 0.5,
                            // Use risk factors from frontend only if provided, otherwise empty (indicates no specific factors)
                            risk_factors: (originalRiskFactors && originalRiskFactors.length > 0) ? originalRiskFactors : [],
                            positive_factors: []
                        },
                        resilience_scores: { overall: originalRouteResilienceScore ? originalRouteResilienceScore * 10 : 0 },
                        // Use frontend-passed metrics
                        time: originalRouteTime || "--",
                        distance: originalRouteDistance || "--",
                        cost: originalRouteCost || "--",
                        carbon: originalRouteCarbonEmission || "--",
                        // Also include raw values for calculations
                        time_minutes: origTimeMinutes,
                        distance_km: origDistanceKm,
                        cost_inr: origCostInr,
                        carbon_kg: origCarbonKg
                    };
                    log(`Using fallback originalRouteInfo with frontend data: Time=${originalRouteTime}, Distance=${originalRouteDistance}`);
                }

                const response = {
                    routes: filteredRoutes,
                    comparisonReport: comparisonReport,
                    originalRoute: originalRouteInfo,
                    isReroute: true
                };

                res.json(response);

            } catch (e) {
                log(`Reroute parse error: ${e.message}`, "ERROR");
                res.status(500).json({ error: "Failed to parse reroute results" });
            }
        });

    } catch (err) {
        log(`Reroute internal error: ${err.message}`, "ERROR");
        res.status(500).json({ error: "Internal server error during reroute" });
    }
});

// -----------------------------
// Start Server
// -----------------------------
const PORT = 5000;
app.listen(PORT, () => {
    const startupMessage = `Backend server started on http://localhost:${PORT}`;
    console.log(startupMessage);
    log(startupMessage);
    log("Backend API v2.1 - Formula-Based Scoring with Sentiment Analysis");
    log("Endpoints:");
    log("  GET  / - API information");
    log("  GET  /geocode?city=<name> - Geocode city");
    log("  GET  /route?coordinates=<coords> - Get route");
    log("  POST /analyze-routes - Full route analysis with sentiment");
    log("  POST /rescore-routes - Priority-based re-scoring");
    log("  POST /reroute - Calculate alternative routes");
    log("=" * 60);
});
