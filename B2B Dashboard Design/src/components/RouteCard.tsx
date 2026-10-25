import * as React from "react";

import { Route } from "../App";
import { Clock, DollarSign, Leaf, AlertTriangle, Phone, MessageCircle, ArrowRight } from "lucide-react";
import { Badge } from "./ui/badge";

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onClick: () => void;
  isDarkMode?: boolean;
  originalOrigin?: string; // Original trip origin for rerouted cards
  isRerouted?: boolean; // Whether this card is showing a rerouted route
}

export function RouteCard({ route, isSelected, onClick, isDarkMode = false, originalOrigin, isRerouted = false }: RouteCardProps) {
  const getResilienceBadgeColor = (score: number) => {
    if (isDarkMode) {
      if (score >= 8) return "bg-lime-900/30 text-lime-400 border-lime-800/50 backdrop-blur-sm shadow-lime-900/20";
      if (score >= 6) return "bg-yellow-900/30 text-yellow-400 border-yellow-800/50 backdrop-blur-sm shadow-yellow-900/20";
      return "bg-red-900/30 text-red-400 border-red-800/50 backdrop-blur-sm shadow-red-900/20";
    }
    if (score >= 8) return "bg-lime-100/80 text-lime-700 border-lime-200/50 backdrop-blur-sm";
    if (score >= 6) return "bg-yellow-100/80 text-yellow-700 border-yellow-200/50 backdrop-blur-sm";
    return "bg-red-100/80 text-red-700 border-red-200/50 backdrop-blur-sm";
  };

  const getStatusBadgeColor = (status: Route["status"]) => {
    switch (status) {
      case "Recommended":
        return "bg-lime-500 text-white";
      case "Under Evaluation":
        return "bg-blue-500 text-white";
      case "Flagged":
        return "bg-red-500 text-white";
    }
  };

  const getRiskColor = (risk: Route["disruptionRisk"]) => {
    switch (risk) {
      case "Low":
        return "text-lime-600";
      case "Medium":
        return "text-yellow-600";
      case "High":
        return "text-red-600";
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${isSelected
        ? isDarkMode
          ? route.resilienceScore >= 8
            ? "border-lime-500 bg-lime-900/20 shadow-md"
            : route.resilienceScore >= 6
              ? "border-yellow-500 bg-yellow-900/20 shadow-md"
              : "border-red-500 bg-red-900/20 shadow-md"
          : route.resilienceScore >= 8
            ? "border-lime-500 bg-lime-50 shadow-md"
            : route.resilienceScore >= 6
              ? "border-yellow-500 bg-yellow-50 shadow-md"
              : "border-red-500 bg-red-50 shadow-md"
        : isDarkMode
          ? "border-gray-600 bg-gray-700 hover:border-gray-500"
          : "border-gray-200 bg-white hover:border-gray-300"
        }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Only show: Origin → Intermediate City → Destination format for REROUTED routes */}
            {isRerouted && originalOrigin ? (
              <>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{originalOrigin}</span>
                <ArrowRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                {route.intermediate_cities && route.intermediate_cities.length >= 1 && (
                  <>
                    <span className={isDarkMode ? 'text-lime-400 font-medium' : 'text-lime-600 font-medium'}>
                      {route.intermediate_cities[0].name}
                    </span>
                    <ArrowRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  </>
                )}
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.destination}</span>
              </>
            ) : (
              // Default: Simple Origin → Destination format for non-rerouted routes
              <>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.origin}</span>
                <ArrowRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.destination}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusBadgeColor(route.status)}>
              {route.status}
            </Badge>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-lg border ${getResilienceBadgeColor(
            route.resilienceScore
          )}`}
        >
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Resilience</div>
          <div className="font-semibold">{route.resilienceScore.toFixed(2)}/10</div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'
            }`}>
            <Clock className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Time</div>
            <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.time}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-green-900/30' : 'bg-green-50'
            }`}>
            <DollarSign className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
          </div>
          <div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cost</div>
            <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.cost}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'
            }`}>
            <Leaf className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
          </div>
          <div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Carbon</div>
            <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.carbonEmission}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-orange-900/30' : 'bg-orange-50'
            }`}>
            <AlertTriangle className={`w-4 h-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
          </div>
          <div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Risk</div>
            <div className={getRiskColor(route.disruptionRisk)}>
              {route.disruptionRisk}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center text-white text-xs">
            {route.courier.avatar}
          </div>
          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{route.courier.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isDarkMode
            ? 'bg-gray-600 hover:bg-gray-500'
            : 'bg-gray-100 hover:bg-gray-200'
            }`}>
            <Phone className={`w-3.5 h-3.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </button>
          <button className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isDarkMode
            ? 'bg-gray-600 hover:bg-gray-500'
            : 'bg-gray-100 hover:bg-gray-200'
            }`}>
            <MessageCircle className={`w-3.5 h-3.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>
    </button>
  );
}