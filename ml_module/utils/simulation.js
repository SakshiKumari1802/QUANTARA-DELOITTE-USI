
import CoveredPoint from "../../backend/models/CoveredPoints.js";

async function simulateRoute(routeDoc) {

    console.log("🚀 Simulation started for route:", routeDoc.route_name);

    if (!Array.isArray(routeDoc.decoded_coordinates)) {
        console.error("❌ decoded_coordinates missing");
        return;
    }

    // Points are NOT cleared - we want to keep them for traversed path visualization

    let sequence = 0;
    for (const point of routeDoc.decoded_coordinates) {
        sequence++;

        const isIntermediate = routeDoc.intermediate_cities?.some(city =>
            Math.abs(city.lat - point.lat) < 0.05 &&
            Math.abs(city.lon - point.lng) < 0.05
        ) || false;

        console.log("💾 SAVING COVERED POINT", point.lat, point.lng, `(Seq: ${sequence})`);

        await CoveredPoint.create({
            mlRouteId: routeDoc.ml_route_id,  // Fixed: use mlRouteId for consistency
            routeName: routeDoc.route_name,

            source: routeDoc.source,
            destination: routeDoc.destination,

            lat: point.lat,
            lon: point.lng,

            sequence: sequence,  // Added: sequence for correct ordering
            isIntermediate
        });

        await new Promise(res => setTimeout(res, 300));
    }

    console.log("✅ Simulation completed");
}

export default simulateRoute;
