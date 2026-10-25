import * as React from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface LoadingOverlayProps {
  isVisible: boolean;
  progress: number;
  logs: string[];
  isDarkMode?: boolean;
}

export function LoadingOverlay({ isVisible, progress, logs, isDarkMode = false }: LoadingOverlayProps) {
  if (!isVisible) return null;

  const latestLog = logs[logs.length - 1] || "";
  const isError = latestLog.startsWith("✗");
  const isComplete = latestLog.includes("✓") || progress >= 100;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-sm`}>
      <div className={`w-full max-w-2xl mx-4 p-8 rounded-2xl shadow-2xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            {isError ? (
              <XCircle className="w-12 h-12 text-red-500" />
            ) : isComplete ? (
              <CheckCircle2 className="w-12 h-12 text-lime-500" />
            ) : (
              <Loader2 className="w-12 h-12 text-lime-500 animate-spin" />
            )}
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {isError ? "Error" : isComplete ? "Analysis Complete" : "Analyzing Routes"}
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {isError ? "Failed to analyze routes" : isComplete ? "Routes are ready" : "Processing your route request..."}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className={`h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className={`h-full transition-all duration-300 ${
                isError ? 'bg-red-500' : isComplete ? 'bg-lime-500' : 'bg-lime-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {progress}% Complete
            </span>
            {!isComplete && !isError && (
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Please wait...
              </span>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className={`max-h-64 overflow-y-auto rounded-lg p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <div className={`text-xs font-mono space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {logs.length === 0 ? (
              <div className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>Initializing...</div>
            ) : (
              logs.map((log, index) => {
                const isErrorLog = log.startsWith("✗");
                const isSuccessLog = log.includes("✓");
                return (
                  <div
                    key={index}
                    className={`py-1 ${
                      isErrorLog
                        ? 'text-red-400'
                        : isSuccessLog
                        ? 'text-lime-400'
                        : isDarkMode
                        ? 'text-gray-300'
                        : 'text-gray-700'
                    }`}
                  >
                    <span className="opacity-60">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Status Message */}
        {latestLog && (
          <div className={`mt-4 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {latestLog}
          </div>
        )}
      </div>
    </div>
  );
}


