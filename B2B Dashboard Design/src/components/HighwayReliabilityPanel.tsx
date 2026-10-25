import { useState } from "react";
import { ChevronDown, ChevronUp, Route as RouteIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as React from "react";

interface HighwaySegment {
  id: string;
  name: string;
  reliabilityScore: number;
  status: string[];
}

const mockHighways: HighwaySegment[] = [
  {
    id: "1",
    name: "NH48",
    reliabilityScore: 8.9,
    status: ["Stable", "Low Traffic"],
  },
  {
    id: "2",
    name: "NH60",
    reliabilityScore: 7.2,
    status: ["High Traffic Zone"],
  },
  {
    id: "3",
    name: "SH16",
    reliabilityScore: 6.4,
    status: ["Flood-Prone", "Accident Hotspot"],
  },
  {
    id: "4",
    name: "NH44",
    reliabilityScore: 8.5,
    status: ["Stable"],
  },
  {
    id: "5",
    name: "SH22",
    reliabilityScore: 5.8,
    status: ["Under Construction"],
  },
];

interface HighwayReliabilityPanelProps {
  isDarkMode?: boolean;
}

export function HighwayReliabilityPanel({ isDarkMode = false }: HighwayReliabilityPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getScoreBadgeColor = (score: number) => {
    if (isDarkMode) {
      if (score >= 8) return "bg-lime-900/30 text-lime-400 border-lime-800/50 backdrop-blur-sm";
      if (score >= 6) return "bg-yellow-900/30 text-yellow-400 border-yellow-800/50 backdrop-blur-sm";
      return "bg-red-900/30 text-red-400 border-red-800/50 backdrop-blur-sm";
    }
    if (score >= 8) return "bg-lime-100/80 text-lime-700 border-lime-200/50 backdrop-blur-sm";
    if (score >= 6) return "bg-yellow-100/80 text-yellow-700 border-yellow-200/50 backdrop-blur-sm";
    return "bg-red-100/80 text-red-700 border-red-200/50 backdrop-blur-sm";
  };

  const getStatusColor = (status: string) => {
    if (isDarkMode) {
      if (status === "Stable" || status === "Low Traffic") return "bg-emerald-900/30 text-emerald-400 backdrop-blur-sm border border-emerald-900/50";
      if (status === "High Traffic Zone") return "bg-yellow-900/30 text-yellow-400 backdrop-blur-sm border border-yellow-900/50";
      return "bg-red-900/30 text-red-400 backdrop-blur-sm border border-red-900/50";
    }
    if (status === "Stable" || status === "Low Traffic") return "bg-emerald-50/80 text-emerald-700 backdrop-blur-sm border border-emerald-100/50";
    if (status === "High Traffic Zone") return "bg-yellow-50/80 text-yellow-700 backdrop-blur-sm border border-yellow-100/50";
    return "bg-red-50/80 text-red-700 backdrop-blur-sm border border-red-100/50";
  };

  return (
    <div className={`rounded-xl shadow-lg border ${isDarkMode
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200'
      } p-4`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-3 hover:opacity-70 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <RouteIcon className={`w-4 h-4 ${isDarkMode ? 'text-lime-400' : 'text-lime-600'}`} />
          <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            Highway Reliability
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {mockHighways.map((highway) => (
              <div
                key={highway.id}
                className={`p-3 rounded-lg border ${isDarkMode
                  ? 'bg-gray-700/50 border-gray-600'
                  : 'bg-gray-50 border-gray-100'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                    {highway.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs border ${getScoreBadgeColor(
                      highway.reliabilityScore
                    )}`}
                  >
                    {highway.reliabilityScore}/10
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {highway.status.map((status, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded text-xs ${getStatusColor(status)}`}
                    >
                      {status}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}