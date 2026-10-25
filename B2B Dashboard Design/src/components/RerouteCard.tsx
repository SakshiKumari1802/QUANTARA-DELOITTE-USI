import React from "react";

interface RouteCardProps {
    routeId: string;
    sequence: string[];
    risk: string;
    time: string;
    selected: boolean;
    onSelect: () => void;
}

export default function RerouteCard({ routeId, sequence, risk, time, selected, onSelect }: RouteCardProps) {
    return (
        <div
            onClick={onSelect}
            className={`w-full cursor-pointer rounded-2xl p-6 border transition-all 
        ${selected
                    ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                    : "border-white/10 bg-[#1A1D23] hover:border-indigo-500 hover:shadow-md"}`
            }
        >
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-indigo-400 font-medium">Route {routeId}</span>
                {selected && (
                    <img src="/assets/check.svg" alt="selected" className="w-5 h-5" />
                )}
            </div>
            <div className="text-gray-300 text-sm flex flex-wrap gap-1 mb-4">
                {sequence.map((city, index) => (
                    <React.Fragment key={index}>
                        <span>{city}</span>
                        {index !== sequence.length - 1 && (
                            <img src="/assets/arrow.svg" alt="arrow" className="w-3 h-3 mx-1" />
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="flex justify-between mb-4 text-gray-400 text-sm">
                <span>Risk Score: <b className="text-gray-200">{risk}</b></span>
                <span>Duration: <b className="text-gray-200">{time}</b></span>
            </div>
            <div className="w-full h-28 rounded-xl bg-[#0F1115] border border-white/10 flex items-center justify-center">
                <img src="/assets/map-placeholder.svg" className="w-10 opacity-40" />
            </div>
        </div>
    );
}
