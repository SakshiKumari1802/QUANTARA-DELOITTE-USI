import { Cloud, AlertTriangle, Car, Info, RefreshCw } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import * as React from "react";


interface NewsAlert {
  id: string;
  category: "weather" | "hazard" | "traffic" | "govt";
  headline: string;
  timestamp: string;
  severity: "moderate" | "high";
}

const mockAlerts: NewsAlert[] = [
  {
    id: "1",
    category: "weather",
    headline: "Heavy rainfall expected on NH48 near Vadodara",
    timestamp: "12 min ago",
    severity: "high",
  },
  {
    id: "2",
    category: "traffic",
    headline: "Traffic congestion on NH60 - Estimated 45 min delay",
    timestamp: "28 min ago",
    severity: "moderate",
  },
  {
    id: "3",
    category: "hazard",
    headline: "Accident reported on SH16 - Right lane blocked",
    timestamp: "1 hr ago",
    severity: "high",
  },
  {
    id: "4",
    category: "govt",
    headline: "Road closure advisory for NH44 maintenance (9 PM - 6 AM)",
    timestamp: "2 hrs ago",
    severity: "moderate",
  },
  {
    id: "5",
    category: "weather",
    headline: "Dense fog warning for NH2 corridor - Low visibility",
    timestamp: "3 hrs ago",
    severity: "moderate",
  },
];

interface LiveNewsAlertsProps {
  isDarkMode?: boolean;
}

export function LiveNewsAlerts({ isDarkMode = false }: LiveNewsAlertsProps) {
  const getCategoryIcon = (category: NewsAlert["category"]) => {
    switch (category) {
      case "weather":
        return <Cloud className="w-4 h-4" />;
      case "hazard":
        return <AlertTriangle className="w-4 h-4" />;
      case "traffic":
        return <Car className="w-4 h-4" />;
      case "govt":
        return <Info className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: NewsAlert["category"]) => {
    if (isDarkMode) {
      switch (category) {
        case "weather":
          return "text-yellow-400";
        case "hazard":
          return "text-red-400";
        case "traffic":
          return "text-orange-400";
        case "govt":
          return "text-blue-400";
      }
    }
    switch (category) {
      case "weather":
        return "text-yellow-600";
      case "hazard":
        return "text-red-600";
      case "traffic":
        return "text-orange-600";
      case "govt":
        return "text-blue-600";
    }
  };

  const getSeverityBg = (severity: NewsAlert["severity"]) => {
    if (isDarkMode) {
      return severity === "high"
        ? "bg-red-900/30 border-red-800/50 backdrop-blur-sm"
        : "bg-yellow-900/30 border-yellow-800/50 backdrop-blur-sm";
    }
    return severity === "high"
      ? "bg-red-50/80 border-red-100/50 backdrop-blur-sm"
      : "bg-yellow-50/80 border-yellow-100/50 backdrop-blur-sm";
  };

  return (
    <div className={`rounded-xl shadow-lg border ${isDarkMode
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200'
      } p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${isDarkMode ? 'text-lime-400' : 'text-lime-600'}`} />
          <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            Live Risk Alerts
          </span>
        </div>
        <button className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="h-64">
        <div className="space-y-2 pr-4">
          {mockAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${getSeverityBg(alert.severity)}`}
            >
              <div className="flex gap-3">
                <div className={`flex-shrink-0 ${getCategoryColor(alert.category)}`}>
                  {getCategoryIcon(alert.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                    {alert.headline}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                      {alert.timestamp}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${alert.severity === "high"
                          ? isDarkMode
                            ? "bg-red-900/40 text-red-400"
                            : "bg-red-100 text-red-700"
                          : isDarkMode
                            ? "bg-yellow-900/40 text-yellow-400"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                    >
                      {alert.severity === "high" ? "High" : "Moderate"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}