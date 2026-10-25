import { Route } from "../App";
import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import polyline from "@mapbox/polyline"; // <-- Decode GraphHopper polyline
import { motion, AnimatePresence } from "framer-motion";

import {
  Navigation,
  AlertCircle,
  Cloud,
  Phone,
  Clock,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  TriangleAlert,
  FileText,
} from "lucide-react";
import { ReportModal } from "./ReportModal";

// Fix leaflet icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  route: Route;
  isDarkMode?: boolean;
  onSimulate?: () => void;
  onReroute?: (location: { lat: number, lon: number }, pathHistory: [number, number][]) => void;
  onRouteUpdate?: (newRoute: Route, pathData: { traversed: [number, number][], abandoned: [number, number][] }) => void;
  traversedPath?: [number, number][];
  abandonedPath?: [number, number][];
}

// Automatically re-center and fix map container issues
function MapController({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();

  React.useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  React.useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

// Custom icon for intermediate cities
const IntermediateIcon = L.icon({
  iconUrl: "/assets/intermediate-pin.png",
  iconSize: [30, 30],
  iconAnchor: [15, 38], // Lifted 8px to clear the route line completely
  popupAnchor: [0, -38]
});

export function MapView({ route, isDarkMode = false, onSimulate, onReroute, onRouteUpdate, traversedPath, abandonedPath }: MapViewProps) {
  const [originCoords, setOriginCoords] = React.useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = React.useState<[number, number] | null>(null);
  const [originalOriginCoords, setOriginalOriginCoords] = React.useState<[number, number] | null>(null);
  const [intermediateCoords, setIntermediateCoords] = React.useState<[number, number][]>([]);
  const [routePath, setRoutePath] = React.useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isGeminiOutputOpen, setIsGeminiOutputOpen] = React.useState(false);
  const [coveredIndex, setCoveredIndex] = React.useState<number>(0);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [instabilityPopupPos, setInstabilityPopupPos] = React.useState<[number, number] | null>(null);
  const popupMarkerRef = React.useRef<L.Marker>(null);
  const [isReroute, setIsReroute] = React.useState(false);
  const hasSimulatedRerouteRef = React.useRef(false);

  // In-Popup Reroute States
  const [rerouters, setRerouters] = React.useState<Route[]>([]);
  const [rerouteSource, setRerouteSource] = React.useState<string>("");
  const [isLoadingReroute, setIsLoadingReroute] = React.useState(false);

  // Report Modal States
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [comparisonReport, setComparisonReport] = React.useState<any>(null);
  const [originalRouteData, setOriginalRouteData] = React.useState<any>(null);
  const [selectedRerouteData, setSelectedRerouteData] = React.useState<Route | null>(null);
  const [simulationCompleted, setSimulationCompleted] = React.useState(false);

  React.useEffect(() => {
    if (instabilityPopupPos && popupMarkerRef.current) {
      setTimeout(() => {
        popupMarkerRef.current?.openPopup();
      }, 100);
    }
  }, [instabilityPopupPos]);

  React.useEffect(() => {
    setInstabilityPopupPos(null);
    setRerouters([]);
    setRerouteSource("");

    // Reset reroute state when traversedPath is cleared (new route analysis)
    if (!traversedPath || traversedPath.length === 0) {
      setIsReroute(false);
      setOriginalOriginCoords(null);
      hasSimulatedRerouteRef.current = false;
    }
  }, [route, traversedPath]);

  const formatTime = (timeStr: string) => {
    // Attempt to parse "1064 mins" or similar
    const match = timeStr.match(/(\d+)\s*mins?/);
    if (match) {
      const mins = parseInt(match[1]);
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      if (hrs > 0) return `${hrs} hrs ${m} mins`;
      return `${m} mins`;
    }
    return timeStr;
  };

  const handleFetchReroutes = async () => {
    if (!instabilityPopupPos) return;

    setIsLoadingReroute(true);

    // Use the 2nd intermediate city as source since simulation stops there
    const interCities = (route as any).intermediate_cities || [];
    const sourceName = interCities.length >= 2 ? interCities[1].name : (interCities.length >= 1 ? interCities[0].name : "Current Location");
    setRerouteSource(sourceName);

    // Note: We no longer call onReroute here to avoid navigating to a separate page
    // All reroute logic is handled inline in this popup

    try {
      // Calculate traversed metrics (from origin to current location)
      let traversedMetrics = {
        distanceKm: 0,
        timeMinutes: 0,
        costInr: 0,
        carbonKg: 0
      };

      if (routePath && routePath.length > 0 && instabilityPopupPos) {
        // Simple Haversine distance calculation
        const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          var R = 6371; // Radius of the earth in km
          var dLat = (lat2 - lat1) * (Math.PI / 180);
          var dLon = (lon2 - lon1) * (Math.PI / 180);
          var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        // Find index of nearest point to instabilityPopupPos
        let minIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < routePath.length; i++) {
          const dist = getDistanceFromLatLonInKm(routePath[i][0], routePath[i][1], instabilityPopupPos[0], instabilityPopupPos[1]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = i;
          }
        }

        // Calculate distance up to that point
        let currentDist = 0;
        for (let i = 0; i < minIdx; i++) {
          currentDist += getDistanceFromLatLonInKm(routePath[i][0], routePath[i][1], routePath[i + 1][0], routePath[i + 1][1]);
        }

        traversedMetrics.distanceKm = Math.round(currentDist);

        // Parse total route metrics to estimate traversed values proportionally
        let totalDist = 0;
        const distMatch = route.distance.match(/(\d+)/);
        if (distMatch) totalDist = parseInt(distMatch[1]);

        if (totalDist > 0) {
          const ratio = currentDist / totalDist;

          // Time
          let totalTimeMins = 0;
          const hrsMatch = route.time.match(/(\d+)\s*hrs?/);
          const minsMatch = route.time.match(/(\d+)\s*mins?/);
          if (hrsMatch) totalTimeMins += parseInt(hrsMatch[1]) * 60;
          if (minsMatch) totalTimeMins += parseInt(minsMatch[1]);
          traversedMetrics.timeMinutes = Math.round(totalTimeMins * ratio);

          // Cost
          let totalCost = 0;
          const costMatch = route.cost.replace(/[₹,]/g, '').match(/(\d+)/);
          if (costMatch) totalCost = parseInt(costMatch[1]);
          traversedMetrics.costInr = Math.round(totalCost * ratio);

          // Carbon
          let totalCarbon = 0;
          const carbonMatch = route.carbonEmission.match(/(\d+)/);
          if (carbonMatch) totalCarbon = parseInt(carbonMatch[1]);
          traversedMetrics.carbonKg = Math.round(totalCarbon * ratio);
        }
      }

      console.log("Calculated traversed metrics:", traversedMetrics);

      const response = await axios.post("http://localhost:5000/reroute", {
        currentLocation: { lat: instabilityPopupPos[0], lon: instabilityPopupPos[1] },
        destination: route.destination,
        excludeRouteId: route.id,
        excludeRouteName: route.courier.name,
        sourceName: sourceName,
        // Pass original trip info for report generation
        originalTripSource: route.origin,
        originalTripDestination: route.destination,
        originalRouteName: route.courier.name,
        // Pass original route metrics for fallback
        originalRouteTime: route.time,
        originalRouteDistance: route.distance,
        originalRouteCost: route.cost,
        originalRouteCarbonEmission: route.carbonEmission,
        originalRouteResilienceScore: route.resilienceScore,
        // Pass specific traversed metrics so backend can add them to new route metrics
        traversedMetrics: traversedMetrics,
        // Pass any known risk factors
        originalRiskFactors: (route as any).news_sentiment_analysis?.risk_factors ||
          (route as any).geminiOutput?.risk_factors ||
          (route as any).analysisData?.risk_factors ||
          []
      });

      if (response.data.routes) {
        // Sort reroutes by resilience score (descending)
        const sortedReroutes = response.data.routes.sort((a: Route, b: Route) => b.resilienceScore - a.resilienceScore);
        setRerouters(sortedReroutes);

        // Store comparison report and original route for later
        if (response.data.comparisonReport) {
          setComparisonReport(response.data.comparisonReport);
        }

        // Set original route data - use response data if available, otherwise construct from current route
        if (response.data.originalRoute) {
          setOriginalRouteData({
            ...response.data.originalRoute,
            // Ensure source is the original trip origin, not the reroute source
            source: response.data.originalRoute.source || route.origin,
            destination: response.data.originalRoute.destination || route.destination
          });
        } else {
          // Fallback: construct from current route data with full metrics
          // Parse time to get minutes
          let timeMinutes = 0;
          if (route.time) {
            const hrsMatch = route.time.match(/(\d+)\s*hrs?/);
            const minsMatch = route.time.match(/(\d+)\s*mins?/);
            if (hrsMatch) timeMinutes += parseInt(hrsMatch[1]) * 60;
            if (minsMatch) timeMinutes += parseInt(minsMatch[1]);
          }

          // Parse distance, cost, carbon
          const distanceKm = route.distance ? parseInt(route.distance.match(/(\d+)/)?.[1] || '0') : 0;
          const costInr = route.cost ? parseInt(route.cost.replace(/[₹,]/g, '').match(/(\d+)/)?.[1] || '0') : 0;
          const carbonKg = route.carbonEmission ? parseInt(route.carbonEmission.match(/(\d+)/)?.[1] || '0') : 0;

          setOriginalRouteData({
            route_name: route.courier.name,
            source: route.origin,
            destination: route.destination,
            sentiment_analysis: {
              sentiment_score: 0.5,
              risk_factors: (route as any).geminiOutput?.risk_factors ||
                (route as any).analysisData?.risk_factors ||
                ["Instability detected - route conditions changed"],
              positive_factors: []
            },
            resilience_scores: { overall: route.resilienceScore * 10 },
            // Include route metrics
            time: route.time,
            distance: route.distance,
            cost: route.cost,
            carbon: route.carbonEmission,
            // Include numeric values for calculations
            time_minutes: timeMinutes,
            distance_km: distanceKm,
            cost_inr: costInr,
            carbon_kg: carbonKg
          });
        }
      }
    } catch (e) {
      console.error("Reroute fetch failed", e);
    } finally {
      setIsLoadingReroute(false);
    }
  };


  const handleConfirmReroute = (newRoute: Route) => {
    // Calculate the traversed path (up to current position) and abandoned path (remaining old route)
    const traversedPathData = routePath.slice(0, coveredIndex + 1) as [number, number][];
    const abandonedPathData = routePath.slice(coveredIndex) as [number, number][];

    // Save original origin coordinates before switching routes
    if (originCoords && !originalOriginCoords) {
      setOriginalOriginCoords(originCoords);
    }

    // Store the selected reroute for report
    setSelectedRerouteData(newRoute);
    setSimulationCompleted(false); // Reset, will be set true when reroute simulation completes

    // Set reroute flag to indicate we're on a rerouted path
    setIsReroute(true);

    // Close popup and reset states
    setInstabilityPopupPos(null);
    setRerouters([]);
    setRerouteSource("");
    setCoveredIndex(0);
    setIsSimulating(false);

    // Update route in parent with path data
    if (onRouteUpdate) {
      onRouteUpdate(newRoute, { traversed: traversedPathData, abandoned: abandonedPathData });
    }
  };

  // Removed old handleRerouteClick to avoid confusion, logic moved to handleFetchReroutes

  // Helper to samples indices from a segment range
  const sampleIndices = (startIdx: number, endIdx: number, count: number) => {
    const length = endIdx - startIdx;
    if (length <= 0) return [];
    if (length <= count) return Array.from({ length }, (_, i) => startIdx + i + 1); // Return all points if short

    const step = Math.floor(length / count);
    const sampled = [];
    for (let i = 1; i <= count; i++) {
      sampled.push(startIdx + Math.min(i * step, length));
    }
    return sampled;
  };

  const getSimulationIndices = (fullPath: [number, number][], intermediateCities: any[]) => {
    if (intermediateCities.length < 2) return [];

    const city1 = intermediateCities[0];
    const city2 = intermediateCities[1];

    // Helper to find nearest index on path
    const findNearestIndex = (targetLat: number, targetLon: number) => {
      let minD = Infinity;
      let bestIdx = -1;

      fullPath.forEach((p, i) => {
        const d = Math.pow(p[0] - targetLat, 2) + Math.pow(p[1] - targetLon, 2);
        if (d < minD) {
          minD = d;
          bestIdx = i;
        }
      });
      return bestIdx;
    };

    const idx1 = findNearestIndex(city1.lat, city1.lon);
    const idx2 = findNearestIndex(city2.lat, city2.lon);

    if (idx1 === -1 || idx2 === -1) return [];

    // Segment 0: Start(0) -> City1(idx1)
    const indices1 = sampleIndices(0, idx1, 5);

    // Segment 1: City1(idx1) -> City2(idx2)
    const indices2 = sampleIndices(idx1, idx2, 5);

    // Construct sequence of INDICES
    // Stop at the SECOND intermediate city (idx2) as this is where the disruption occurs
    return [...indices1, idx1, ...indices2, idx2];
  };

  const handleSimulate = async () => {
    if (!onSimulate) return;

    setIsSimulating(true);
    setCoveredIndex(0); // Reset to start

    const simulationIndices = getSimulationIndices(routePath, (route as any).intermediate_cities || []);

    if (simulationIndices.length === 0) {
      setIsSimulating(false);
      return;
    }

    // Start loop
    const stopIdx = simulationIndices[simulationIndices.length - 1];

    for (let i = 0; i < simulationIndices.length; i++) {
      const idx = simulationIndices[i];
      const point = routePath[idx]; // Get actual coord from path

      // Update UI: Advance the cut-point
      setCoveredIndex(idx);

      // Record to Backend
      if (point) {
        try {
          await axios.post('http://localhost:5000/record-point', {
            routeId: route.id,
            routeName: route.courier.name,
            lat: point[0],
            lon: point[1],
            sequence: i + 1,
            isIntermediate: false, // You might want to flag if idx === idx1 or idx2
            source: route.origin,
            destination: route.destination
          });
        } catch (err) {
          // Silent fail for simulation recording
        }
      }

      // Check if we reached the 2nd intermediate city
      if (idx === stopIdx) {
        setIsSimulating(false);
        setInstabilityPopupPos(point);
        return; // Stop simulation here
      }

      // Delay 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setIsSimulating(false);
  };

  // Continuous simulation for rerouted paths - goes all the way to destination
  const simulationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleContinuousSimulation = React.useCallback(async () => {
    if (routePath.length === 0) return;

    setIsSimulating(true);
    setCoveredIndex(0);

    // Sample ~20 points evenly distributed along the route
    const totalPoints = routePath.length;
    const sampleCount = Math.min(20, totalPoints);
    const step = Math.floor(totalPoints / sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.min(i * step, totalPoints - 1);

      // Update UI: Advance the covered path
      setCoveredIndex(idx);

      // Delay 1.5 seconds between points for smooth animation
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Ensure we reach the destination
    setCoveredIndex(totalPoints - 1);

    setIsSimulating(false);

    // Mark that reroute simulation has completed
    hasSimulatedRerouteRef.current = true;
    setSimulationCompleted(true); // Enable "Show Report" button
  }, [routePath]);
  const geocodeCity = async (city: string): Promise<[number, number] | null> => {
    try {
      const response = await axios.get(
        `http://localhost:5000/geocode?city=${encodeURIComponent(city)}`
      );

      if (response.data?.features?.length > 0) {
        const [lon, lat] = response.data.features[0].geometry.coordinates;
        return [lat, lon]; // convert to Leaflet order
      }
      return null;
    } catch (err: any) {
      console.error(`Geocoding error for ${city}:`, err);

      // Handle axios errors with status codes
      if (err.response) {
        const status = err.response.status;
        const errorMessage = err.response.data?.error || err.response.statusText || "Unknown error";

        if (status === 500) {
          console.error(`Server error while geocoding ${city}: ${errorMessage}`);
        } else if (status === 400) {
          console.error(`Invalid request for ${city}: ${errorMessage}`);
        }
      } else if (err.request) {
        console.error(`Network error while geocoding ${city}: Could not reach backend server`);
      }

      return null;
    }
  };

  // ------------------------------
  // 2) Fetch GraphHopper Route
  // ------------------------------
  const fetchRoute = async (coordinates: [number, number][]) => {
    try {
      const coordsString = coordinates
        .map((coord) => `${coord[1]},${coord[0]}`) // Leaflet [lat,lon] → GH [lon,lat]
        .join(";");

      const response = await axios.get("http://localhost:5000/route", {
        params: { coordinates: coordsString },
      });

      if (!response.data.paths || response.data.paths.length === 0) {
        throw new Error("No route found (GraphHopper)");
      }

      const encoded = response.data.paths[0].points;

      // Decode Google polyline → returns [lat, lon]
      const decoded = polyline.decode(encoded);

      // Convert to Leaflet format
      return decoded.map((points: [number, number]) => {
        const [lat, lon] = points;
        return [lat, lon] as [number, number];
      });
    } catch (err: any) {
      console.error("Route fetching error:", err);

      // Handle axios errors with status codes
      if (err.response) {
        const status = err.response.status;
        const errorMessage = err.response.data?.error || err.response.statusText || "Unknown error";

        if (status === 500) {
          throw new Error(`Server error: ${errorMessage}. Please check if the backend server is running and GraphHopper API key is configured.`);
        } else if (status === 400) {
          throw new Error(`Invalid request: ${errorMessage}`);
        } else {
          throw new Error(`Request failed (${status}): ${errorMessage}`);
        }
      } else if (err.request) {
        throw new Error("Network error: Could not reach the backend server. Please ensure the server is running on http://localhost:5000");
      } else {
        throw new Error(err.message || "Failed to fetch route");
      }
    }
  };

  // ------------------------------
  // 3) Load map, geocode cities, fetch route (only source and destination)
  // ------------------------------
  React.useEffect(() => {
    const loadMapData = async () => {
      setIsLoading(true);
      setError(null);
      setRoutePath([]);

      try {
        // Check if coordinates are already in route object (from backend)
        let origin: [number, number] | null = null;
        let dest: [number, number] | null = null;

        if ((route as any).coordinates?.origin && (route as any).coordinates?.destination) {
          // Use coordinates from backend
          origin = (route as any).coordinates.origin;
          dest = (route as any).coordinates.destination;
        } else {
          // Fallback to geocoding
          origin = await geocodeCity(route.origin);
          dest = await geocodeCity(route.destination);
        }

        // Geocode intermediate waypoints
        // 1. Try to use coordinates from backend model if available
        if ((route as any).intermediate_cities && (route as any).intermediate_cities.length > 0) {
          // Limit to showing only 2 intermediate cities as per user requirement
          const rawCities = (route as any).intermediate_cities;
          const citiesToShow = rawCities.length > 2 ? rawCities.slice(0, 2) : rawCities;

          const coords = citiesToShow.map((city: any) => [city.lat, city.lon] as [number, number]);
          setIntermediateCoords(coords);
        } else {
          // 2. Fallback: Geocode from 'waypoints' string array
          const waypoints = route.waypoints || [];
          const waypointCoords: [number, number][] = [];

          // Parallel geocoding for waypoints
          if (waypoints.length > 0) {
            const results = await Promise.all(waypoints.map(city => geocodeCity(city)));
            results.forEach(res => {
              if (res) waypointCoords.push(res);
            });
            setIntermediateCoords(waypointCoords);
          } else {
            setIntermediateCoords([]);
          }
        }

        if (origin && dest) {
          setOriginCoords(origin);
          setDestCoords(dest);

          let path: [number, number][] = [];

          // Check for overview_polyline passed from backend (Google Maps/ML result)
          if (route.overview_polyline) {
            // Decode Google Polyline string -> [[lat, lon], ...]
            const decodedPath = polyline.decode(route.overview_polyline);
            // Convert to Leaflet tuple format if needed (polyline.decode returns [lat, lon] which matches Leaflet)
            const decoded = polyline.decode(route.overview_polyline);
            path = decoded.map((points) => {
              const [lat, lon] = points;
              return [lat, lon] as [number, number];
            });
            console.log("Using provided route polyline, points:", path.length);
            setRoutePath(path);
          } else {
            // Fallback: Fetch route from GraphHopper if no polyline provided
            console.log("No polyline provided, fetching from GraphHopper...");
            try {
              path = await fetchRoute([origin, dest]); // Assuming fetchRoute returns path
              setRoutePath(path);
            } catch (e) {
              console.error(e);
            }
          }

          // Helper to find nearest point on path
          const findNearestPoint = (target: [number, number], pathPoints: [number, number][]) => {
            if (pathPoints.length === 0) return target;
            let minDist = Infinity;
            let nearest = target;

            for (const point of pathPoints) {
              const dist = Math.sqrt(Math.pow(point[0] - target[0], 2) + Math.pow(point[1] - target[1], 2));
              if (dist < minDist) {
                minDist = dist;
                nearest = point;
              }
            }
            return nearest;
          };

          // Geocode intermediate waypoints OR use model data
          console.log("Intermediate cities data:", (route as any).intermediate_cities);
          if ((route as any).intermediate_cities && (route as any).intermediate_cities.length > 0) {
            const coords = (route as any).intermediate_cities.map((city: any) => {
              const rawLat = city.lat;
              const rawLon = city.lon;
              console.log("Processing intermediate city:", city.name, rawLat, rawLon);
              // Snap to path if available
              if (path.length > 0) {
                return findNearestPoint([rawLat, rawLon], path);
              }
              return [rawLat, rawLon] as [number, number];
            });
            console.log("Setting intermediateCoords:", coords);
            setIntermediateCoords(coords);
          } else {
            // Fallback: Geocode from 'waypoints' string array
            const waypoints = route.waypoints || [];
            const waypointCoords: [number, number][] = [];

            // Parallel geocoding for waypoints
            if (waypoints.length > 0) {
              const results = await Promise.all(waypoints.map(city => geocodeCity(city)));
              results.forEach(res => {
                if (res) {
                  // Also snap geocoded points if path exists
                  if (path.length > 0) {
                    waypointCoords.push(findNearestPoint(res, path));
                  } else {
                    waypointCoords.push(res);
                  }
                }
              });
              setIntermediateCoords(waypointCoords);
            } else {
              setIntermediateCoords([]);
            }
          }
        } else {
          setError("Could not find coordinates for one or both cities.");
        }
      } catch (err: any) {
        console.error("Map loading error:", err);
        setError(err.message || "Routing service failed.");
      } finally {
        setIsLoading(false);
      }
    };

    loadMapData();
  }, [route]);

  // Auto-start continuous simulation 3 seconds after reroute path loads
  React.useEffect(() => {
    // Only trigger if: reroute mode, path exists, not currently simulating, and hasn't already simulated
    if (isReroute && routePath.length > 0 && !isSimulating && !hasSimulatedRerouteRef.current) {
      // Clear any existing timeout
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }

      // Start simulation after 3 seconds
      simulationTimeoutRef.current = setTimeout(() => {
        console.log("Auto-starting continuous simulation on rerouted path...");
        handleContinuousSimulation();
      }, 3000);
    }

    // Cleanup on unmount
    return () => {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
    };
  }, [isReroute, routePath.length, isSimulating, handleContinuousSimulation]);

  const bounds: L.LatLngBoundsExpression | null =
    originCoords && destCoords ? [originCoords, destCoords] : null;

  // ------------------------------
  // 4) Render Component
  // ------------------------------

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 relative overflow-hidden z-0">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
              <span className="mt-2 text-gray-600 dark:text-gray-300">Calculating route...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-50 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-red-300">
                <AlertCircle className="text-red-600 w-5 h-5 mr-2 inline" />
                {error}
              </div>
            </div>
          )}

          <MapContainer
            center={[20.5937, 78.9629]} // India center
            zoom={5}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            <MapController bounds={bounds} />

            {/* Origin Marker - Use original origin when on rerouted path */}
            {(isReroute ? originalOriginCoords : originCoords) && (
              <Marker position={(isReroute && originalOriginCoords) ? originalOriginCoords : originCoords!}>
                <Popup><strong>Origin:</strong> {route.origin}</Popup>
              </Marker>
            )}

            {destCoords && (
              <Marker position={destCoords}>
                <Popup><strong>Destination:</strong> {route.destination}</Popup>
              </Marker>
            )}

            {/* Layered Blue Path for "Light & Dark" Effect */}
            {coveredIndex > 0 && routePath.length > 0 && (
              <>
                {/* Outer Glow (Light Blue) */}
                <Polyline
                  positions={routePath.slice(0, coveredIndex + 1)}
                  color="#60a5fa"
                  weight={8}
                  opacity={0.6}
                />
                {/* Inner Core (Dark Blue) */}
                <Polyline
                  positions={routePath.slice(0, coveredIndex + 1)}
                  color="#1e3a8a"
                  weight={4}
                  opacity={1.0}
                />
              </>
            )}

            {/* Green Remaining Path (Sliced from current index onwards) */}
            {routePath.length > 0 && (
              <Polyline
                positions={routePath.slice(coveredIndex)}
                color="#65a30d"
                weight={6}
                opacity={0.9}
              />
            )}

            {/* Traversed Path (History) - Dark Blue */}
            {traversedPath && traversedPath.length > 0 && (
              <Polyline
                positions={traversedPath}
                color="#1e3a8a"
                weight={4}
                opacity={1.0}
              />
            )}

            {/* Abandoned Path (Old route that wasn't traversed) - Dark Green */}
            {abandonedPath && abandonedPath.length > 0 && (
              <Polyline
                positions={abandonedPath}
                color="#365314"
                weight={5}
                opacity={0.7}
                dashArray="10, 10"
                smoothFactor={0}
              />
            )}

            {/* Instability Popup Anchor */}
            {instabilityPopupPos && (
              <Marker position={instabilityPopupPos} ref={popupMarkerRef}>
                <Popup
                  className="instability-popup"
                  closeButton={false}
                  autoPan={true}
                  minWidth={350}
                  maxWidth={350}
                  autoClose={false}
                  closeOnClick={false}
                >
                  {!rerouters || rerouters.length === 0 ? (
                    isLoadingReroute ? (
                      <div className="p-4 flex flex-col items-center justify-center min-h-[150px]">
                        <Loader2 className="w-8 h-8 animate-spin text-lime-500 mb-2" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Calculating alternatives...</p>
                        <p className="text-xs text-gray-400 mt-1">Analyzing traffic & weather...</p>
                      </div>
                    ) : (
                      <div className="p-3 max-w-xs">
                        <div className="flex items-center gap-2 mb-2 text-amber-500">
                          <TriangleAlert className="w-5 h-5" />
                          <span className="font-bold text-sm uppercase tracking-wide">Instability Ahead</span>
                        </div>
                        <p className="text-gray-600 text-xs mb-4 leading-relaxed dark:text-gray-300">
                          Severe weather disruption predicted on the upcoming segment. Efficiency is dropping rapidly.
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFetchReroutes();
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          <TrendingUp className="w-4 h-4" />
                          <span>Find Alternative Routes</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-2">
                      <div className="mb-3 border-b pb-2 border-gray-100 dark:border-gray-700">
                        <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Alternative Routes</h4>
                        <p className="text-[10px] text-gray-500">From {rerouteSource || "Current Location"}</p>
                      </div>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                        {rerouters.map(r => (
                          <div
                            key={r.id}
                            onClick={() => handleConfirmReroute(r)}
                            className="group cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                  {r.courier.avatar}
                                </div>
                                <span className="font-medium text-xs text-gray-700 dark:text-gray-300 group-hover:text-indigo-600">{r.courier.name}</span>
                              </div>
                              <span className="bg-lime-100 text-lime-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                {(r.resilienceScore).toFixed(1)}/10
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 pl-8">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(r.time)}</span>
                              <span className="flex items-center gap-1">{r.distance}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Popup>
              </Marker>
            )}

            {/* Intermediate Markers */}
            {intermediateCoords.map((coord, index) => {
              // Try to get name from intermediate_cities first, then waypoints
              const cityName = (route as any).intermediate_cities?.[index]?.name || route.waypoints?.[index] || "Way point";

              return (
                <CircleMarker
                  key={`waypoint-${index}`}
                  center={coord}
                  radius={6}
                  pathOptions={{
                    fillColor: "#3b82f6", // Blue-500
                    fillOpacity: 1,
                    color: "white",
                    weight: 2,
                  }}
                >
                  <Popup><strong>Via:</strong> {cityName}</Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Efficiency Score (using resilience score from ML module) */}
          <div className="absolute top-6 right-6 flex gap-3 z-[400]">
            <motion.div
              initial={false}
              animate={{ width: isGeminiOutputOpen ? 384 : "auto" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`rounded-xl shadow-lg bg-white/90 dark:bg-gray-800/90 overflow-hidden`}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-lime-600 dark:text-lime-400" />
                    <div>
                      <div className="text-xs text-gray-500">Efficiency Score</div>
                      <div className="text-lg font-semibold">{Math.round(route.resilienceScore * 10)}%</div>
                    </div>
                  </div>
                  {route.geminiOutput && (
                    <button
                      onClick={() => setIsGeminiOutputOpen(!isGeminiOutputOpen)}
                      className={`p-1.5 rounded-lg transition-colors ${isDarkMode
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      title="View AI Analysis"
                    >
                      {isGeminiOutputOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Gemini Output Dropdown */}
              <AnimatePresence>
                {isGeminiOutputOpen && route.geminiOutput && (
                  <motion.div
                    key="gemini-dropdown"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className={`border-t px-4 overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                  >
                    <div className="py-4 max-h-96 overflow-y-auto custom-scrollbar w-[22rem]">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-lime-600 dark:text-lime-400" />
                        <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                          AI Analysis Details
                        </h4>
                      </div>

                      {/* Summary */}
                      <div className="mb-4">
                        <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          Summary
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          {route.geminiOutput.short_summary}
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div className="mb-4">
                        <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          Reasoning
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          {route.geminiOutput.reasoning}
                        </div>
                      </div>

                      {/* Detailed Scores */}
                      <div>
                        <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          Detailed Scores (0-100)
                        </div>
                        <div className="space-y-2">
                          {/* Weather Risk Score */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                Weather Risk
                              </span>
                              <span className={`text-sm font-semibold ${route.geminiOutput.weather_risk_score > 70
                                ? 'text-red-500'
                                : route.geminiOutput.weather_risk_score > 40
                                  ? 'text-yellow-500'
                                  : 'text-green-500'
                                }`}>
                                {route.geminiOutput.weather_risk_score}
                              </span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                              }`}>
                              <div
                                className={`h-full ${route.geminiOutput.weather_risk_score > 70
                                  ? 'bg-red-500'
                                  : route.geminiOutput.weather_risk_score > 40
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                  }`}
                                style={{ width: `${route.geminiOutput.weather_risk_score}%` }}
                              />
                            </div>
                          </div>

                          {/* Road Safety Score */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                Road Safety
                              </span>
                              <span className={`text-sm font-semibold ${route.geminiOutput.road_safety_score > 70
                                ? 'text-green-500'
                                : route.geminiOutput.road_safety_score > 40
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                                }`}>
                                {route.geminiOutput.road_safety_score}
                              </span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                              }`}>
                              <div
                                className={`h-full ${route.geminiOutput.road_safety_score > 70
                                  ? 'bg-green-500'
                                  : route.geminiOutput.road_safety_score > 40
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                  }`}
                                style={{ width: `${route.geminiOutput.road_safety_score}%` }}
                              />
                            </div>
                          </div>

                          {/* Carbon Emission Score */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                Carbon Efficiency
                              </span>
                              <span className={`text-sm font-semibold ${(route.geminiOutput.carbon_score || 0) > 70
                                ? 'text-green-500'
                                : (route.geminiOutput.carbon_score || 0) > 40
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                                }`}>
                                {route.geminiOutput.carbon_score || 0}
                              </span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                              }`}>
                              <div
                                className={`h-full ${(route.geminiOutput.carbon_score || 0) > 70
                                  ? 'bg-green-500'
                                  : (route.geminiOutput.carbon_score || 0) > 40
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                  }`}
                                style={{ width: `${route.geminiOutput.carbon_score || 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Overall Resilience Score */}
                          <div className="pt-2 border-t border-gray-300 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                Overall Resilience
                              </span>
                              <span className={`text-sm font-bold ${route.geminiOutput.overall_resilience_score > 70
                                ? 'text-lime-500'
                                : route.geminiOutput.overall_resilience_score > 40
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                                }`}>
                                {route.geminiOutput.overall_resilience_score}
                              </span>
                            </div>
                            <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                              }`}>
                              <div
                                className={`h-full ${route.geminiOutput.overall_resilience_score > 70
                                  ? 'bg-lime-500'
                                  : route.geminiOutput.overall_resilience_score > 40
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                  }`}
                                style={{ width: `${route.geminiOutput.overall_resilience_score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* Bottom Stats Bar – Theme-aware */}
        <div className={`border-t px-8 py-5 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Route</div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {/* Show: Original Origin → Intermediate City → Destination ONLY for rerouted routes */}
                  {isReroute && originalOriginCoords && originalRouteData?.source ? (
                    <>
                      <span>{originalRouteData.source}</span>
                      <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>→</span>
                      {route.intermediate_cities && route.intermediate_cities.length >= 1 && (
                        <>
                          <span className={isDarkMode ? 'text-lime-400 font-medium' : 'text-lime-600 font-medium'}>
                            {route.intermediate_cities[0].name}
                          </span>
                          <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>→</span>
                        </>
                      )}
                      <span>{route.destination}</span>
                    </>
                  ) : (
                    // Default: Simple Origin → Destination format
                    <>
                      <span>{route.origin}</span>
                      <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>→</span>
                      <span>{route.destination}</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Distance</div>
                <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.distance}</div>
              </div>
              <div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Estimated Time</div>
                <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>{route.time}</div>
              </div>
            </div>

            {/* Conditional button: Show Report after reroute completes, otherwise Start Trip */}
            {simulationCompleted && isReroute ? (
              <button
                onClick={() => setShowReportModal(true)}
                className={`px-6 py-2.5 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-2 backdrop-blur-xl border-2 shadow-2xl ${isDarkMode
                  ? 'bg-gradient-to-r from-indigo-500/80 to-indigo-600/80 border-white/20 shadow-indigo-500/30 text-white'
                  : 'bg-gradient-to-r from-indigo-600/90 to-indigo-700/90 border-white/40 shadow-indigo-600/30 text-white'
                  }`}
              >
                <FileText className="w-4 h-4" />
                Show Report
              </button>
            ) : (
              <button
                onClick={handleSimulate}
                disabled={isSimulating || isReroute}
                className={`px-6 py-2.5 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 backdrop-blur-xl border-2 shadow-2xl ${isSimulating || isReroute
                  ? isDarkMode ? 'bg-gray-600/50 border-gray-500/50 cursor-not-allowed text-gray-400' : 'bg-gray-400/50 border-gray-300/50 cursor-not-allowed text-gray-200'
                  : isDarkMode
                    ? 'bg-gradient-to-r from-lime-500/80 to-lime-600/80 border-white/20 shadow-lime-500/30 text-white'
                    : 'bg-gradient-to-r from-lime-500/90 to-lime-600/90 border-white/40 shadow-lime-600/30 text-white'
                  }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                {isSimulating ? 'Simulating...' : 'Start Trip'}
              </button>
            )}
          </div>
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          comparisonReport={comparisonReport}
          originalRoute={originalRouteData}
          newRoute={selectedRerouteData}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}
