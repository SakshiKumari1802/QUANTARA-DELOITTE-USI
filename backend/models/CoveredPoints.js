import mongoose from "mongoose";

const CoveredPointSchema = new mongoose.Schema({
    routeDbId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecommendedRoute"
    },

    mlRouteId: String,       // from ML response (id: "1")
    routeName: String,

    source: String,
    destination: String,

    lat: Number,
    lon: Number,

    isIntermediate: Boolean,

    coveredAt: {
        type: Date,
        default: Date.now
    }
});



export default mongoose.model("CoveredPoint", CoveredPointSchema);
