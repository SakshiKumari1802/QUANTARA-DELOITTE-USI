import * as React from "react";

import { Route } from "../App";
import { RouteCard } from "./RouteCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface RouteListProps {
  routes: Route[];
  selectedRoute: Route;
  onSelectRoute: (route: Route) => void;
  isDarkMode?: boolean;
  originalOrigin?: string; // Original trip origin for rerouted routes
  isRerouted?: boolean; // Whether we're displaying a rerouted route
}

export function RouteList({ routes, selectedRoute, onSelectRoute, isDarkMode = false, originalOrigin, isRerouted = false }: RouteListProps) {
  // Routes with resilience score > 8 are recommended (sorted by efficiency/score descending)
  // Routes with resilience score > 8 are recommended (sorted by efficiency/score descending)
  // Fallback: If no routes > 8, recommend the single best route available
  let recommendedRoutes = routes
    .filter(route => route.resilienceScore > 8)
    .sort((a, b) => b.resilienceScore - a.resilienceScore);

  if (recommendedRoutes.length === 0 && routes.length > 0) {
    // Sort all routes and take the best one
    const sortedAll = [...routes].sort((a, b) => b.resilienceScore - a.resilienceScore);
    recommendedRoutes = [sortedAll[0]];
  }

  // All routes are evaluated (all routes from ML module, sorted by efficiency/score descending)
  // This matches the number of routes returned by ML module
  const evaluatedRoutes = [...routes].sort((a, b) => b.resilienceScore - a.resilienceScore);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-4">
        <h2 className={isDarkMode ? 'text-white' : 'text-gray-900'}>{" "}Active Routes</h2>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Monitor and compare route performance</p>
      </div>

      <Tabs defaultValue={recommendedRoutes.length > 0 ? "recommended" : "evaluated"} className="flex-1 flex flex-col">
        <div className="px-6">
          <TabsList className={`w-full h-auto p-1 rounded-full border ${isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-gray-100 border-gray-200'
            }`}>
            <TabsTrigger
              value="recommended"
              className={`flex-1 rounded-full transition-all duration-300 ${isDarkMode
                ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lime-500/80 data-[state=active]:to-lime-600/80 data-[state=active]:backdrop-blur-xl data-[state=active]:border data-[state=active]:border-white/10 data-[state=active]:shadow-[0_0_20px_rgba(132,204,22,0.3)] data-[state=active]:text-white'
                : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lime-500 data-[state=active]:to-lime-600 data-[state=active]:shadow-lg data-[state=active]:text-white'
                }`}
            >
              Recommended
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-transform group-hover:scale-105 ${isDarkMode
                ? 'bg-black/20 text-white backdrop-blur-sm'
                : 'bg-white/20 data-[state=inactive]:bg-gray-200 data-[state=inactive]:text-gray-600'
                }`}>
                {recommendedRoutes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="evaluated"
              className={`flex-1 rounded-full transition-all duration-300 ${isDarkMode
                ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lime-500/80 data-[state=active]:to-lime-600/80 data-[state=active]:backdrop-blur-xl data-[state=active]:border data-[state=active]:border-white/10 data-[state=active]:shadow-[0_0_20px_rgba(132,204,22,0.3)] data-[state=active]:text-white'
                : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-lime-500 data-[state=active]:to-lime-600 data-[state=active]:shadow-lg data-[state=active]:text-white'
                }`}
            >
              Evaluated
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-transform group-hover:scale-105 ${isDarkMode
                ? 'bg-black/20 text-white backdrop-blur-sm'
                : 'bg-white/20 data-[state=inactive]:bg-gray-200 data-[state=inactive]:text-gray-600'
                }`}>
                {evaluatedRoutes.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recommended" className="flex-1 overflow-y-auto px-6 mt-4">
          <div className="space-y-3 pb-6">
            {recommendedRoutes.length > 0 ? (
              recommendedRoutes.map((route) => (
                <RouteCard
                  key={`rec-${route.id}`}
                  route={route}
                  isSelected={selectedRoute?.id === route.id}
                  onClick={() => onSelectRoute(route)}
                  isDarkMode={isDarkMode}
                  originalOrigin={originalOrigin}
                  isRerouted={isRerouted}
                />
              ))
            ) : (
              <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>No recommended routes found.</p>
                <p className="text-sm mt-2">Try adjusting your source or destination.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="evaluated" className="flex-1 overflow-y-auto px-6 mt-4">
          <div className="space-y-3 pb-6">
            {evaluatedRoutes.length > 0 ? (
              evaluatedRoutes.map((route) => (
                <RouteCard
                  key={`eval-${route.id}`}
                  route={route}
                  isSelected={selectedRoute?.id === route.id}
                  onClick={() => onSelectRoute(route)}
                  isDarkMode={isDarkMode}
                  originalOrigin={originalOrigin}
                  isRerouted={isRerouted}
                />
              ))
            ) : (
              <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <p>No routes evaluated yet.</p>
                <p className="text-sm mt-2">Routes will appear here after analysis.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}