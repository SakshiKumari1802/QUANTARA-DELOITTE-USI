
import * as React from "react";
import { Moon, Sun, ArrowRight, MapPin, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SelectionPageProps {
    onContinue: (source: string, destination: string) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    osmnxEnabled: boolean;
    onToggleOsmnx: (value: boolean) => void;
}

const CITIES = [
    "Mumbai",
    "Delhi",
    "Bangalore",
    "Chennai",
    "Kolkata",
];

export function SelectionPage({ onContinue, isDarkMode, toggleTheme, osmnxEnabled, onToggleOsmnx }: SelectionPageProps) {
    const [source, setSource] = useState<string>("");
    const [destination, setDestination] = useState<string>("");

    const availableDestinations = CITIES.filter((city) => city !== source);

    const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSource(e.target.value);
        // Reset destination if it's the same as the new source (though filtered out, just to be safe)
        if (e.target.value === destination) {
            setDestination("");
        }
    };

    const handleContinue = () => {
        if (source && destination) {
            onContinue(source, destination);
        }
    };

    return (
        <div className={`h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 ${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
            }`}>
            {/* Theme Toggle (Top Right) */}
            <div className="absolute top-6 right-6">
                <button
                    onClick={toggleTheme}
                    className={`p-3 rounded-full shadow-lg transition-transform hover:scale-105 ${isDarkMode ? "bg-gray-800 text-yellow-400" : "bg-white text-gray-600"
                        }`}
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>

            <div className={`w-full max-w-md p-8 rounded-2xl shadow-xl border transition-all ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
                }`}>
                <div className="text-center mb-8">
                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? "bg-lime-500/20 text-lime-400" : "bg-lime-100 text-lime-600"}`}>
                        <MapPin className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Plan Your Route</h1>
                    <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                        Select your origin and destination to get started
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Source Input */}
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                            Source City
                        </label>
                        <div className="relative">
                            <select
                                value={source}
                                onChange={handleSourceChange}
                                className={`w-full p-3 pr-10 rounded-lg border outline-none appearance-none transition-all cursor-pointer ${isDarkMode
                                    ? "bg-gray-900 border-gray-600 focus:border-lime-500 text-white"
                                    : "bg-gray-50 border-gray-200 focus:border-lime-500 text-gray-900"
                                    }`}
                            >
                                <option value="" disabled hidden>Select Origin</option>
                                {CITIES.map((city) => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
                        </div>
                    </div>

                    {/* Destination Input */}
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                            Destination City
                        </label>
                        <div className="relative">
                            <select
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                className={`w-full p-3 pr-10 rounded-lg border outline-none appearance-none transition-all cursor-pointer ${isDarkMode
                                    ? "bg-gray-900 border-gray-600 focus:border-lime-500 text-white"
                                    : "bg-gray-50 border-gray-200 focus:border-lime-500 text-gray-900"
                                    } ${!source ? "opacity-50 cursor-not-allowed" : ""}`}
                                disabled={!source}
                            >
                                <option value="" disabled hidden>
                                    {source ? "Select Destination" : "Select Source First"}
                                </option>
                                {availableDestinations.map((city) => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
                        </div>
                    </div>

                    {/* OSMnx Option */}
                    <div className="flex items-center justify-between text-xs">
                        <label
                            className="flex items-center gap-2 cursor-pointer"
                            title="Enabling this option will increase accuracy but also increase the processing time"
                        >
                            <input
                                type="checkbox"
                                className="rounded border-gray-400"
                                checked={osmnxEnabled}
                                onChange={(e) => onToggleOsmnx(e.target.checked)}
                            />
                            <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                Use detailed road data (OSMnx)
                            </span>
                        </label>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleContinue}
                        disabled={!source || !destination}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${source && destination
                            ? "bg-lime-500 hover:bg-lime-400 text-slate-900 hover:scale-105 shadow-lg hover:shadow-lime-500/25"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                            }`}
                    >
                        Find Routes
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
