import { Slider } from "./ui/slider";
import { Gauge, RefreshCw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as React from "react";


interface RouteSensitivityControlsProps {
  isDarkMode?: boolean;
  onPrioritiesChange?: (priorities: { time: number; distance: number; safety: number; carbonEmission: number }) => void;
  onRecalculate?: (priorities: { time: number; distance: number; safety: number; carbonEmission: number }) => void;
  disabled?: boolean;
  isRecalculating?: boolean;
  headerActions?: React.ReactNode;
}

export function RouteSensitivityControls({
  isDarkMode = false,
  onPrioritiesChange,
  onRecalculate,
  disabled = false,
  isRecalculating = false,
  headerActions
}: RouteSensitivityControlsProps) {
  const [timePriority, setTimePriority] = useState([25]);
  const [distancePriority, setDistancePriority] = useState([25]);
  const [safetyPriority, setSafetyPriority] = useState([25]);
  const [carbonPriority, setCarbonPriority] = useState([25]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialPriorities, setInitialPriorities] = useState({ time: 25, distance: 25, safety: 25, carbonEmission: 25 });
  const isFirstRender = React.useRef(true);

  // Update parent when any priority changes (skip first render) - but don't trigger recalculation
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setInitialPriorities({
        time: timePriority[0],
        distance: distancePriority[0],
        safety: safetyPriority[0],
        carbonEmission: carbonPriority[0]
      });
      return;
    }

    // Check if priorities have changed from initial values
    const currentPriorities = {
      time: timePriority[0],
      distance: distancePriority[0],
      safety: safetyPriority[0],
      carbonEmission: carbonPriority[0]
    };

    const changed =
      currentPriorities.time !== initialPriorities.time ||
      currentPriorities.distance !== initialPriorities.distance ||
      currentPriorities.safety !== initialPriorities.safety ||
      currentPriorities.carbonEmission !== initialPriorities.carbonEmission;

    setHasChanges(changed);

    // Update parent with new priorities (but don't trigger recalculation)
    if (onPrioritiesChange) {
      onPrioritiesChange(currentPriorities);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePriority, distancePriority, safetyPriority, carbonPriority]);

  const handleSliderChange = (setter: (value: number[]) => void) => {
    return (value: number[]) => {
      setter(value);
    };
  };

  const handleRecalculate = () => {
    if (onRecalculate && !disabled && !isRecalculating) {
      const currentPriorities = {
        time: timePriority[0],
        distance: distancePriority[0],
        safety: safetyPriority[0],
        carbonEmission: carbonPriority[0]
      };

      // Update initial priorities to current (so button disappears after recalculation)
      setInitialPriorities(currentPriorities);
      setHasChanges(false);

      // Trigger recalculation
      onRecalculate(currentPriorities);
    }
  };

  return (
    <div className={`rounded-xl shadow-lg border ${isDarkMode
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200'
      } p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-lime-900/30' : 'bg-lime-100'
            }`}>
            <Gauge className={isDarkMode ? 'w-5 h-5 text-lime-400' : 'w-5 h-5 text-lime-600'} />
          </div>
          <div>
            <h3 className={isDarkMode ? 'text-white' : 'text-gray-900'}>
              Route Sensitivity Controls
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Adjust route priorities and click recalculate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {hasChanges && !isRecalculating && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleRecalculate}
                disabled={disabled}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${disabled
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-lime-600 hover:bg-lime-500 text-white'
                    : 'bg-lime-500 hover:bg-lime-600 text-white'
                  }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm">Recalculate</span>
              </motion.button>
            )}
            {isRecalculating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <div className="flex gap-1">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                    className="w-1.5 h-1.5 rounded-full bg-lime-500"
                  />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                    className="w-1.5 h-1.5 rounded-full bg-lime-500"
                  />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                    className="w-1.5 h-1.5 rounded-full bg-lime-500"
                  />
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-lime-400' : 'text-lime-600'}`}>
                  Recalculating...
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {headerActions}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div>
          <label className={`text-xs mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Time Priority
          </label>
          <Slider
            value={timePriority}
            onValueChange={handleSliderChange(setTimePriority)}
            max={100}
            step={1}
            className="mb-2"
            disabled={disabled}
          />
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {timePriority[0]}%
          </span>
        </div>

        <div>
          <label className={`text-xs mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Distance Priority
          </label>
          <Slider
            value={distancePriority}
            onValueChange={handleSliderChange(setDistancePriority)}
            max={100}
            step={1}
            className="mb-2"
            disabled={disabled}
          />
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {distancePriority[0]}%
          </span>
        </div>

        <div>
          <label className={`text-xs mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Safety Priority
          </label>
          <Slider
            value={safetyPriority}
            onValueChange={handleSliderChange(setSafetyPriority)}
            max={100}
            step={1}
            className="mb-2"
            disabled={disabled}
          />
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {safetyPriority[0]}%
          </span>
        </div>

        <div>
          <label className={`text-xs mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Carbon Emission Priority
          </label>
          <Slider
            value={carbonPriority}
            onValueChange={handleSliderChange(setCarbonPriority)}
            max={100}
            step={1}
            className="mb-2"
            disabled={disabled}
          />
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {carbonPriority[0]}%
          </span>
        </div>
      </div>
    </div >
  );
}
