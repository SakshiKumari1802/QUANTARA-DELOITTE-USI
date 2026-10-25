import React, { useState } from "react";
import RouteCard from "./RerouteCard";

interface Route {
    id: string;
    time: string;
    resilienceScore: number;
    intermediate_cities?: { name: string }[];
    [key: string]: any; // Allow other properties
}

interface RerouteSelectionProps {
    routes: Route[];
    onContinue: (routeId: string) => void;
}

export default function RerouteSelection({ routes, onContinue }: RerouteSelectionProps) {
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

    const handleContinue = () => {
        if (selectedRouteId && onContinue) {
            onContinue(selectedRouteId);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0F1115] text-white p-10 flex flex-col items-center">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-semibold mb-2">Choose Alternative Route</h1>
                <p className="text-gray-400 text-sm">
                    We found {routes?.length || 0} safe options avoiding the disruption.
                </p>
            </div>

            <div className="flex flex-col gap-6 w-full max-w-3xl">
                {routes && routes.map((route) => (
                    <RouteCard
                        key={route.id}
                        routeId={route.id}
                        sequence={route.intermediate_cities?.map(c => c.name) || []}
                        risk={route.resilienceScore.toFixed(1)} // Using score as proxy for now
                        time={route.time}
                        selected={selectedRouteId === route.id}
                        onSelect={() => setSelectedRouteId(route.id)}
                    />
                ))}
            </div>

            <div className="mt-10">
                <button
                    onClick={handleContinue}
                    disabled={!selectedRouteId}
                    className={`px-8 py-3 rounded-xl text-sm font-medium transition-all transform hover:scale-105
            ${selectedRouteId
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}
                >
                    Confirm Reroute
                </button>
            </div>
        </div>
    );
}
