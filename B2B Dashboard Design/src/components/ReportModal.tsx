import * as React from "react";
import { X, Download, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, Route, Fuel, DollarSign, Activity } from "lucide-react";

interface ComparisonReport {
    summary: string;
    sentiment_change: {
        direction: "improved" | "worsened" | "stable";
        percentage_change: string;
        reason: string;
    };
    risk_comparison: {
        new_risks: string[];
        resolved_risks: string[];
        ongoing_risks: string[];
    };
    tradeoffs: {
        factor: string;
        old_value: string;
        new_value: string;
        change: string;
        assessment: string;
    }[];
    recommendation: string;
}

interface OriginalRoute {
    route_name: string;
    source: string;
    destination: string;
    // Route metrics for comparison
    time?: string;
    distance?: string;
    cost?: string;
    carbon?: string;
    time_minutes?: number;
    distance_km?: number;
    cost_inr?: number;
    carbon_kg?: number;
    sentiment_analysis?: {
        sentiment_score: number;
        risk_factors: string[];
        positive_factors: string[];
    };
    resilience_scores?: {
        overall: number;
        time: number;
        distance: number;
        carbon: number;
        road_quality: number;
        news_sentiment: number;
    };
}

interface NewRoute {
    courier: { name: string };
    time: string;
    distance: string;
    cost: string;
    carbonEmission: string;
    resilienceScore: number;
    news_sentiment_analysis?: {
        sentiment_score: number;
        risk_factors: string[];
        positive_factors: string[];
    };
}

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    comparisonReport: ComparisonReport | null;
    originalRoute: OriginalRoute | null;
    newRoute: NewRoute | null;
    isDarkMode?: boolean;
}

export function ReportModal({
    isOpen,
    onClose,
    comparisonReport,
    originalRoute,
    newRoute,
    isDarkMode = false
}: ReportModalProps) {
    if (!isOpen) return null;

    const handleDownloadPDF = async () => {
        // In a full implementation, this would call the backend to generate/download PDF
        alert("PDF download functionality - Backend endpoint needed");
    };

    const getSentimentIcon = (direction: string) => {
        switch (direction) {
            case "improved": return <TrendingUp className="w-5 h-5 text-lime-500" />;
            case "worsened": return <TrendingDown className="w-5 h-5 text-red-500" />;
            default: return <Minus className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getChangeColor = (change: string) => {
        if (change.startsWith("+") || change.toLowerCase().includes("improve")) {
            return isDarkMode ? "text-lime-400" : "text-lime-600";
        }
        if (change.startsWith("-") || change.toLowerCase().includes("worse")) {
            return isDarkMode ? "text-red-400" : "text-red-600";
        }
        return isDarkMode ? "text-gray-400" : "text-gray-600";
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-900' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-lime-500/20' : 'bg-lime-100'
                            }`}>
                            <Activity className={`w-5 h-5 ${isDarkMode ? 'text-lime-400' : 'text-lime-600'}`} />
                        </div>
                        <div>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Reroute Analysis Report
                            </h2>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode
                                ? 'bg-lime-500 text-gray-900 hover:bg-lime-400'
                                : 'bg-lime-500 text-white hover:bg-lime-600'
                                }`}
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-full transition-colors ${isDarkMode
                                ? 'hover:bg-gray-800 text-gray-400'
                                : 'hover:bg-gray-100 text-gray-500'
                                }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className={`overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                    }`}>
                    {/* Trip Summary */}
                    <section className={`rounded-xl p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
                        <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-lime-400' : 'text-lime-600'
                            }`}>
                            <Route className="w-4 h-4" />
                            TRIP SUMMARY
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Original Route</span>
                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {originalRoute?.route_name || "Unknown"}
                                </p>
                            </div>
                            <div>
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Rerouted To</span>
                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {newRoute?.courier?.name || "Unknown"}
                                </p>
                            </div>
                            <div>
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Source</span>
                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {originalRoute?.source || "Unknown"}
                                </p>
                            </div>
                            <div>
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Destination</span>
                                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {originalRoute?.destination || "Unknown"}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Why Rerouting Occurred */}
                    <section className={`rounded-xl p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
                        <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'
                            }`}>
                            <AlertTriangle className="w-4 h-4" />
                            WHY REROUTING OCCURRED
                        </h3>
                        <div className="space-y-2">
                            {originalRoute?.sentiment_analysis?.risk_factors?.length ? (
                                originalRoute.sentiment_analysis.risk_factors.map((factor, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-start gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'
                                            }`}
                                    >
                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span className="text-sm">{factor}</span>
                                    </div>
                                ))
                            ) : comparisonReport?.risk_comparison?.resolved_risks?.length ? (
                                // Fallback: Show "Resolved Risks" from comparison report as the reasons for reroute
                                comparisonReport.risk_comparison.resolved_risks.map((factor, idx) => (
                                    <div
                                        key={`resolved-${idx}`}
                                        className={`flex items-start gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'
                                            }`}
                                    >
                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span className="text-sm">Detected Risk: {factor}</span>
                                    </div>
                                ))
                            ) : (
                                <p className={`text-sm italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    No specific risk factors identified
                                </p>
                            )}
                        </div>
                        {comparisonReport?.sentiment_change?.reason && (
                            <p className={`mt-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                <strong>Analysis:</strong> {comparisonReport.sentiment_change.reason}
                            </p>
                        )}
                    </section>

                    {/* Sentiment Change */}
                    {comparisonReport?.sentiment_change && (
                        <section className={`rounded-xl p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
                            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                }`}>
                                <Activity className="w-4 h-4" />
                                SENTIMENT CHANGE
                            </h3>
                            <div className="flex items-center gap-4">
                                {getSentimentIcon(comparisonReport.sentiment_change.direction)}
                                <div>
                                    <span className={`text-2xl font-bold ${comparisonReport.sentiment_change.direction === 'improved'
                                        ? 'text-lime-500'
                                        : comparisonReport.sentiment_change.direction === 'worsened'
                                            ? 'text-red-500'
                                            : 'text-yellow-500'
                                        }`}>
                                        {comparisonReport.sentiment_change.percentage_change}
                                    </span>
                                    <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        ({comparisonReport.sentiment_change.direction})
                                    </span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Comparison Table */}
                    <section className={`rounded-xl p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
                        <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'
                            }`}>
                            COMPARISON METRICS
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <th className={`py-2 px-3 text-left ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Factor</th>
                                        <th className={`py-2 px-3 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Original</th>
                                        <th className={`py-2 px-3 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>After Reroute</th>
                                        <th className={`py-2 px-3 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonReport?.tradeoffs?.map((tradeoff, idx) => (
                                        <tr key={idx} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                            <td className={`py-3 px-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                {tradeoff.factor}
                                            </td>
                                            <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {tradeoff.old_value}
                                            </td>
                                            <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {tradeoff.new_value}
                                            </td>
                                            <td className={`py-3 px-3 text-center font-medium ${getChangeColor(tradeoff.change)}`}>
                                                {tradeoff.change}
                                            </td>
                                        </tr>
                                    )) || (
                                            <>
                                                <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                                    <td className={`py-3 px-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Time</td>
                                                    <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{originalRoute?.time || "--"}</td>
                                                    <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{newRoute?.time || "--"}</td>
                                                    <td className={`py-3 px-3 text-center font-medium ${originalRoute?.time_minutes && newRoute?.time
                                                        ? (() => {
                                                            const newMatch = newRoute.time.match(/(\d+)/);
                                                            const newMins = newMatch ? parseInt(newMatch[1]) : 0;
                                                            const diff = newMins - (originalRoute.time_minutes || 0);
                                                            return diff > 0 ? 'text-red-400' : diff < 0 ? 'text-lime-400' : 'text-gray-400';
                                                        })()
                                                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                                        }`}>
                                                        {originalRoute?.time_minutes && newRoute?.time
                                                            ? (() => {
                                                                const newMatch = newRoute.time.match(/(\d+)/);
                                                                const newMins = newMatch ? parseInt(newMatch[1]) : 0;
                                                                const diff = newMins - (originalRoute.time_minutes || 0);
                                                                return diff > 0 ? `+${diff} mins` : diff < 0 ? `${diff} mins` : "0";
                                                            })()
                                                            : "--"}
                                                    </td>
                                                </tr>
                                                <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                                    <td className={`py-3 px-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Distance</td>
                                                    <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{originalRoute?.distance || "--"}</td>
                                                    <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{newRoute?.distance || "--"}</td>
                                                    <td className={`py-3 px-3 text-center font-medium ${originalRoute?.distance_km && newRoute?.distance
                                                        ? (() => {
                                                            const newMatch = newRoute.distance.match(/(\d+)/);
                                                            const newKm = newMatch ? parseInt(newMatch[1]) : 0;
                                                            const diff = newKm - (originalRoute.distance_km || 0);
                                                            return diff > 0 ? 'text-yellow-400' : diff < 0 ? 'text-lime-400' : 'text-gray-400';
                                                        })()
                                                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                                        }`}>
                                                        {originalRoute?.distance_km && newRoute?.distance
                                                            ? (() => {
                                                                const newMatch = newRoute.distance.match(/(\d+)/);
                                                                const newKm = newMatch ? parseInt(newMatch[1]) : 0;
                                                                const diff = newKm - (originalRoute.distance_km || 0);
                                                                return diff > 0 ? `+${diff} km` : diff < 0 ? `${diff} km` : "0";
                                                            })()
                                                            : "--"}
                                                    </td>
                                                </tr>
                                                <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                                    <td className={`py-3 px-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Cost</td>
                                                    <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{originalRoute?.cost || "--"}</td>
                                                    <td className={`py-3 px-3 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{newRoute?.cost || "--"}</td>
                                                    <td className={`py-3 px-3 text-center font-medium ${originalRoute?.cost_inr && newRoute?.cost
                                                        ? (() => {
                                                            const newMatch = newRoute.cost.replace(/[₹,]/g, '').match(/(\d+)/);
                                                            const newCost = newMatch ? parseInt(newMatch[1]) : 0;
                                                            const diff = newCost - (originalRoute.cost_inr || 0);
                                                            return diff > 0 ? 'text-red-400' : diff < 0 ? 'text-lime-400' : 'text-gray-400';
                                                        })()
                                                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                                        }`}>
                                                        {originalRoute?.cost_inr && newRoute?.cost
                                                            ? (() => {
                                                                const newMatch = newRoute.cost.replace(/[₹,]/g, '').match(/(\d+)/);
                                                                const newCost = newMatch ? parseInt(newMatch[1]) : 0;
                                                                const diff = newCost - (originalRoute.cost_inr || 0);
                                                                return diff > 0 ? `+₹${diff.toLocaleString()}` : diff < 0 ? `-₹${Math.abs(diff).toLocaleString()}` : "₹0";
                                                            })()
                                                            : "--"}
                                                    </td>
                                                </tr>
                                            </>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Recommendation */}
                    <section className={`rounded-xl p-5 ${isDarkMode ? 'bg-lime-900/30 border border-lime-700' : 'bg-lime-50 border border-lime-200'
                        }`}>
                        <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-lime-400' : 'text-lime-700'
                            }`}>
                            <CheckCircle className="w-4 h-4" />
                            CONCLUSION
                        </h3>
                        <p className={`text-sm ${isDarkMode ? 'text-lime-100' : 'text-lime-800'}`}>
                            {comparisonReport?.recommendation || comparisonReport?.summary ||
                                "Route was successfully rerouted to avoid identified risks. The new route provides an alternative path to the destination."}
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
