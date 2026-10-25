"use client";

import * as React from "react"; 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Switch } from "./ui/switch";
import { Database, Truck, Warehouse, MapPin, Cog, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  type: string;
  icon: React.ReactNode;
  status: "Connected" | "Not Connected" | "Requires Setup";
  enabled: boolean;
}

const integrations: Integration[] = [
  {
    id: "1",
    name: "SAP ERP",
    type: "ERP",
    icon: <Database className="w-5 h-5" />,
    status: "Connected",
    enabled: true,
  },
  {
    id: "2",
    name: "Oracle TMS",
    type: "TMS",
    icon: <Truck className="w-5 h-5" />,
    status: "Connected",
    enabled: true,
  },
  {
    id: "3",
    name: "Manhattan WMS",
    type: "WMS",
    icon: <Warehouse className="w-5 h-5" />,
    status: "Not Connected",
    enabled: false,
  },
  {
    id: "4",
    name: "Samsara Telematics",
    type: "Telematics",
    icon: <MapPin className="w-5 h-5" />,
    status: "Connected",
    enabled: true,
  },
  {
    id: "5",
    name: "HERE Route API",
    type: "Route Data",
    icon: <MapPin className="w-5 h-5" />,
    status: "Requires Setup",
    enabled: false,
  },
  {
    id: "6",
    name: "Google Maps API",
    type: "Route Data",
    icon: <MapPin className="w-5 h-5" />,
    status: "Connected",
    enabled: true,
  },
];

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export function IntegrationsModal({ isOpen, onClose, isDarkMode = false }: IntegrationsModalProps) {
  const getStatusIcon = (status: Integration["status"]) => {
    switch (status) {
      case "Connected":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "Not Connected":
        return <XCircle className="w-4 h-4 text-gray-400" />;
      case "Requires Setup":
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: Integration["status"]) => {
    if (isDarkMode) {
      switch (status) {
        case "Connected":
          return "text-green-400";
        case "Not Connected":
          return "text-gray-400";
        case "Requires Setup":
          return "text-yellow-400";
      }
    }
    switch (status) {
      case "Connected":
        return "text-green-600";
      case "Not Connected":
        return "text-gray-500";
      case "Requires Setup":
        return "text-yellow-600";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
        <DialogHeader>
          <DialogTitle className={isDarkMode ? 'text-white' : ''}>
            Integrations Hub
          </DialogTitle>
          <DialogDescription className={isDarkMode ? 'text-gray-400' : ''}>
            Connect your logistics systems and data sources for enhanced route optimization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700/50 border-gray-600' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isDarkMode ? 'bg-lime-900/30 text-lime-400' : 'bg-lime-100 text-lime-600'
                }`}>
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                      {integration.name}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {integration.type}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${getStatusColor(integration.status)}`}>
                    {getStatusIcon(integration.status)}
                    <span>{integration.status}</span>
                  </div>
                </div>
              </div>
              <Switch
                checked={integration.enabled}
                disabled={integration.status === "Not Connected"}
              />
            </div>
          ))}
        </div>

        <div className={`mt-6 p-4 rounded-lg ${
          isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex gap-3">
            <Cog className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                Need help configuring integrations? Contact your system administrator or view our integration documentation.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
