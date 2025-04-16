"use client";

import RouteChart from "@/components/RouteChart";
import {
  Delivery,
  DriverRoute,
  OptimizationRequestData,
  OptimizationResult,
  ProgressUpdate,
} from "@/types/optimization";
import * as signalR from "@microsoft/signalr";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronsRight,
  Clock,
  Info,
  Loader2,
  Map,
  MapPinned,
  Route as RouteIcon, // Renamed to avoid conflict with DriverRoute type
  Settings,
  Star,
  Terminal,
  Truck,
  XCircle,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

export default function Home() {
  const [numDeliveries, setNumDeliveries] = useState<number>(30);
  const [numDrivers, setNumDrivers] = useState<number>(4);
  const [minCoord, setMinCoord] = useState<number>(-1000); // Adjusted default for meters
  const [maxCoord, setMaxCoord] = useState<number>(1000); // Adjusted default for meters
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [logMessages, setLogMessages] = useState<ProgressUpdate[]>([]);
  const [hubConnection, setHubConnection] =
    useState<signalR.HubConnection | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const signalrUrl = process.env.NEXT_PUBLIC_SIGNALR_URL;
    if (!signalrUrl) {
      console.error(
        "Critical Error: SignalR Hub URL is not defined (NEXT_PUBLIC_SIGNALR_URL)."
      );
      setError(
        "Configuration Error: SignalR Hub URL is missing. Real-time logs disabled."
      );
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(signalrUrl)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning) // Less verbose logging
      .build();

    setHubConnection(connection);

    connection.on("ReceiveMessage", (update: ProgressUpdate) => {
      setLogMessages((prevLogs) => {
        const messageWithTimestamp = { ...update, timestamp: Date.now() };
        if (
          messageWithTimestamp.clearPreviousProgress &&
          messageWithTimestamp.style === "progress"
        ) {
          const lastProgressIndex = prevLogs
            .slice()
            .reverse()
            .findIndex((log) => log.style === "progress");
          if (lastProgressIndex !== -1) {
            const indexToReplace = prevLogs.length - 1 - lastProgressIndex;
            const newLogs = [...prevLogs];
            newLogs[indexToReplace] = messageWithTimestamp;
            return newLogs;
          }
        }
        return [...prevLogs, messageWithTimestamp];
      });
    });

    connection
      .start()
      .then(() => console.log("SignalR Connected."))
      .catch((err) => {
        console.error("SignalR Connection Error: ", err);
        setError(
          `Failed to connect to real-time log feed at ${signalrUrl}. Ensure backend is running.`
        );
      });

    return () => {
      connection?.stop().then(() => console.log("SignalR Disconnected."));
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logMessages]);

  const handleInputChange =
    (
      setter: React.Dispatch<React.SetStateAction<number>>,
      minVal: number = -Infinity,
      isInteger: boolean = true // Ensure positive integers for counts
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const rawValue = isInteger
        ? parseInt(e.target.value, 10)
        : parseFloat(e.target.value);
      const value = isNaN(rawValue) ? (minVal > 0 ? minVal : 0) : rawValue;
      setter(Math.max(minVal, value));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);
    setLogMessages([]);

    if (
      !hubConnection ||
      hubConnection.state !== signalR.HubConnectionState.Connected
    ) {
      setLogMessages((prev) => [
        ...prev,
        {
          message: "SignalR not connected. Real-time logs unavailable.",
          style: "error",
          timestamp: Date.now(),
        },
      ]);
    }

    if (numDeliveries <= 0 || numDrivers <= 0) {
      setError(
        "Number of deliveries and drivers must be positive integers."
      );
      setIsLoading(false);
      return;
    }
    if (minCoord >= maxCoord) {
      setError(
        "Minimum coordinate (meters) must be less than the maximum coordinate."
      );
      setIsLoading(false);
      return;
    }

    const requestData: OptimizationRequestData = {
      numberOfDeliveries: numDeliveries,
      numberOfDrivers: numDrivers,
      minCoordinate: minCoord,
      maxCoordinate: maxCoord,
    };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError(
        "Critical Error: API URL is not defined (NEXT_PUBLIC_API_URL)."
      );
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestData),
        cache: "no-store",
      });

      const data: OptimizationResult = await response.json();

      if (!response.ok) {
        let errorMsg =
          data.errorMessage ||
          `Server Error (${response.status}): ${response.statusText}`;
        throw new Error(errorMsg);
      }

      setResults(data);
    } catch (err: unknown) {
      console.error("Optimization API call failed:", err);
      let specificError =
        "An unknown error occurred while processing the request.";
      if (err instanceof Error) {
        if (
          err.message.includes("Failed to fetch") ||
          err.message.includes("NetworkError")
        ) {
          specificError = `Network Error: Failed to connect to the API server at ${apiUrl}. Please check the server status and URL configuration.`;
        } else {
          specificError = `API Communication Error: ${err.message}`;
        }
      }
      setError(specificError);
      setLogMessages((prev) => [
        ...prev,
        {
          message: `API Error: ${
            err instanceof Error ? err.message : "Unknown"
          }`,
          style: "error-large",
          timestamp: Date.now(),
        },
      ]);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getLogStyleClasses = (style: string): string => {
    const base = "block py-0.5 px-1 text-sm leading-relaxed";
    switch (style) {
      case "header":
        return `${base} font-bold text-lg text-fuchsia-500 dark:text-fuchsia-400 border-y border-fuchsia-600 dark:border-fuchsia-500 my-2 py-1 text-center tracking-wider uppercase`;
      case "step-header":
        return `${base} font-semibold text-yellow-500 dark:text-yellow-400 mt-3 mb-1`;
      case "step":
        return `${base} text-yellow-600 dark:text-yellow-400 ml-1`;
      case "info":
        return `${base} text-gray-700 dark:text-gray-300`;
      case "detail":
        return `${base} text-gray-500 dark:text-gray-400 ml-5`;
      case "detail-mono":
        return `${base} text-cyan-600 dark:text-cyan-400 font-mono ml-5 text-xs`;
      case "success":
        return `${base} text-green-600 dark:text-green-400`;
      case "success-large":
        return `${base} text-green-600 dark:text-green-400 font-bold text-lg mt-2`;
      case "warning":
        return `${base} text-amber-600 dark:text-amber-400`;
      case "error":
        return `${base} text-red-600 dark:text-red-500 font-semibold`;
      case "error-large":
        return `${base} text-red-600 dark:text-red-500 font-bold text-lg mt-2`;
      case "result":
        return `${base} text-blue-600 dark:text-blue-400`;
      case "progress":
        return `${base} text-gray-500 dark:text-gray-400 italic ml-5`;
      case "debug":
        return `${base} text-xs text-gray-400 dark:text-gray-500 italic`;
      default:
        return `${base} text-gray-800 dark:text-gray-200`;
    }
  };

  const getLogPrefix = (style: string): React.ReactNode => {
    const iconSize = "w-4 h-4 mr-1.5 flex-shrink-0";
    switch (style) {
      case "step":
        return (
          <span className="text-blue-500 dark:text-blue-400 font-bold mr-1">
            {">"}
          </span>
        );
      case "success":
      case "success-large":
        return (
          <Check
            className={`${iconSize} text-green-500 dark:text-green-400`}
          />
        );
      case "warning":
        return (
          <AlertCircle
            className={`${iconSize} text-amber-500 dark:text-amber-400`}
          />
        );
      case "error":
      case "error-large":
        return (
          <XCircle className={`${iconSize} text-red-500 dark:text-red-400`} />
        );
      case "result":
        return (
          <Star
            className={`${iconSize} text-yellow-500 dark:text-yellow-400`}
          />
        );
      case "detail":
        return (
          <span
            className={`${iconSize} text-gray-400 dark:text-gray-500 text-center`}
          >
            *
          </span>
        );
      case "detail-mono":
        return (
          <ChevronsRight
            className={`${iconSize} text-cyan-500 dark:text-cyan-400`}
          />
        );
      default:
        return null;
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)} s`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)} min`;
    } else {
      return `${(seconds / 3600).toFixed(1)} hr`;
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters.toFixed(1)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-8 md:p-10 bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 dark:from-gray-900 dark:via-slate-950 dark:to-black text-gray-900 dark:text-gray-100 font-sans">
      <div className="w-full max-w-7xl space-y-10">
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-800 dark:text-gray-50 tracking-tight">
            Multi-Driver Route Optimization
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Optimize delivery routes for multiple drivers based on location data.
          </p>
        </header>

        <section className="w-full max-w-xl mx-auto bg-white dark:bg-slate-800/80 backdrop-blur-sm p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label
                  htmlFor="numDeliveries"
                  className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                >
                  <MapPinned className="inline-block w-4 h-4 mr-1 align-text-bottom" />
                  Number of Deliveries:
                </label>
                <input
                  type="number"
                  id="numDeliveries"
                  value={numDeliveries}
                  onChange={handleInputChange(setNumDeliveries, 1)}
                  min="1"
                  required
                  disabled={isLoading}
                  className="input-field"
                />
              </div>
              <div>
                <label
                  htmlFor="numDrivers"
                  className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                >
                  <Truck className="inline-block w-4 h-4 mr-1 align-text-bottom" />
                  Number of Drivers:
                </label>
                <input
                  type="number"
                  id="numDrivers"
                  value={numDrivers}
                  onChange={handleInputChange(setNumDrivers, 1)}
                  min="1"
                  required
                  disabled={isLoading}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center"
              >
                <Settings className="inline-block w-4 h-4 mr-1" /> Advanced
                Settings {showAdvanced ? "(Hide)" : "(Show)"}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t dark:border-gray-600 pt-4 animate-fade-in-fast">
                  <div>
                    <label
                      htmlFor="minCoord"
                      className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                    >
                      Min Coordinate (meters):
                    </label>
                    <input
                      type="number"
                      id="minCoord"
                      value={minCoord}
                      onChange={handleInputChange(setMinCoord, -Infinity, false)}
                      required
                      disabled={isLoading}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="maxCoord"
                      className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                    >
                      Max Coordinate (meters):
                    </label>
                    <input
                      type="number"
                      id="maxCoord"
                      value={maxCoord}
                      onChange={handleInputChange(setMaxCoord, -Infinity, false)}
                      required
                      disabled={isLoading}
                      className="input-field"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center px-6 py-3 font-semibold rounded-lg text-white transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-blue-500 ${
                isLoading
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transform hover:scale-[1.02] shadow-md"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Optimizing Routes...
                </>
              ) : (
                <>
                  <RouteIcon className="h-5 w-5 mr-2" />
                  Calculate Optimal Routes
                </>
              )}
            </button>
          </form>
        </section>

        {error && (
          <section
            className="w-full max-w-4xl mx-auto my-6 p-4 bg-red-100 dark:bg-red-900/70 border-l-4 border-red-500 dark:border-red-600 text-red-800 dark:text-red-100 rounded-md shadow"
            role="alert"
          >
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 mr-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-grow">
                <p className="font-bold text-lg">Error Occurred</p>
                <p className="text-sm mt-1 break-words">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-4 p-1 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 focus:outline-none"
                aria-label="Dismiss error"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {(isLoading || logMessages.length > 0) && (
          <section className="w-full max-w-4xl mx-auto my-6">
            <h3 className="text-xl md:text-2xl font-semibold mb-3 text-center text-gray-800 dark:text-gray-200 flex items-center justify-center">
              <Terminal className="w-6 h-6 mr-2" /> Optimization Log
            </h3>
            <div className="h-96 overflow-y-auto bg-gray-950 dark:bg-black border border-gray-700 dark:border-gray-600 rounded-lg shadow-inner p-4 font-mono text-sm">
              {logMessages.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start ${getLogStyleClasses(
                    log.style
                  )}`}
                >
                  <span className="flex-shrink-0 w-5 text-center pt-0.5">
                    {getLogPrefix(log.style)}
                  </span>
                  <span className="flex-grow break-words whitespace-pre-wrap">
                    {log.message}
                  </span>
                  {log.data?.Time && (
                    <span className="text-gray-500 dark:text-gray-600 ml-2 whitespace-nowrap">
                      ({log.data.Time})
                    </span>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
              {isLoading &&
                !logMessages.some(
                  (log) =>
                    log.style === "success-large" || log.style === "error-large"
                ) && (
                  <div className="flex items-center mt-2">
                    <Loader2 className="animate-spin h-4 w-4 mr-2 text-blue-400" />
                    <span className="text-sm text-gray-400">Processing...</span>
                  </div>
                )}
            </div>
          </section>
        )}

        {results && !isLoading && !error && (
          <section className="w-full mt-8 animate-fade-in space-y-10">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
              Optimization Results Summary
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 text-left">
              <StatCard
                icon={CheckCircle}
                title="Best Method Found"
                value={results.bestMethod}
                tooltip="The algorithm determined to yield the best result (lowest makespan)."
              />
              <StatCard
                icon={Clock}
                title="Longest Driver Time (Makespan)"
                value={`${results.minMakespan.toFixed(
                  1
                )} seconds (~${formatTime(results.minMakespan)})`}
                tooltip="Time taken by the driver with the longest route (distance / 1 m/s)."
              />
              <StatCard
                icon={Map}
                title="Total Distance Covered"
                value={`${(results.bestMethod.includes("NN")
                  ? results.optimizedDistanceNN
                  : results.optimizedDistanceGI
                ).toFixed(1)} meters (~${formatDistance(
                  results.bestMethod.includes("NN")
                    ? results.optimizedDistanceNN
                    : results.optimizedDistanceGI
                )})`}
                tooltip="Sum of distances covered by all drivers in meters."
              />
            </div>

             <div className="text-center p-4 bg-blue-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-slate-700 shadow-sm">
                <Info className="inline-block w-5 h-5 mr-2 text-blue-600 dark:text-blue-400 align-middle" />
                <span className="text-sm text-gray-700 dark:text-gray-300 align-middle">
                    Distances are calculated using Euclidean distance. Time assumes a constant speed of 1 meter per second.
                </span>
            </div>


            <div className="mb-10">
              <h3 className="text-xl md:text-2xl font-semibold mb-5 text-center text-gray-800 dark:text-gray-200">
                Route Visualization
              </h3>
              <RouteChart
                deliveries={results.generatedDeliveries || []}
                driverRoutes={results.driverRoutes || []}
              />
            </div>

            <div>
              <h3 className="text-xl md:text-2xl font-semibold mb-5 text-center text-gray-800 dark:text-gray-200">
                Driver Route Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(results.driverRoutes ?? []).length > 0 ? (
                  results.driverRoutes
                    .sort((a, b) => a.driverId - b.driverId) // Sort by driver ID
                    .map((route) => (
                      <DriverRouteCard
                        key={route.driverId}
                        route={route}
                        formatTime={formatTime}
                        formatDistance={formatDistance}
                      />
                    ))
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4 md:col-span-2 lg:col-span-3">
                    No driver routes generated or assigned.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
      <style jsx global>{`
        .input-field {
          @apply w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition duration-150 ease-in-out;
          -webkit-appearance: textfield; /* Correct appearance for number inputs */
          -moz-appearance: textfield;
          appearance: textfield;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .animate-fade-in-fast {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  tooltip?: string;
}
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  tooltip,
}) => (
  <div
    className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center space-x-4 rtl:space-x-reverse group relative"
    title={tooltip} // Basic tooltip on hover
  >
    <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5">
        {title}
      </p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
    {tooltip && (
       <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-xs bg-gray-800 text-white text-xs rounded py-1 px-2 z-10 shadow-lg">
         {tooltip}
         <svg className="absolute text-gray-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
       </div>
     )}
  </div>
);

interface DriverRouteCardProps {
  route: DriverRoute;
  formatTime: (seconds: number) => string;
  formatDistance: (meters: number) => string;
}
const DriverRouteCard: React.FC<DriverRouteCardProps> = ({
  route,
  formatTime,
  formatDistance,
}) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300 ease-in-out flex flex-col">
    <h4 className="flex items-center font-semibold text-lg mb-3 text-blue-700 dark:text-blue-400 border-b dark:border-gray-600 pb-2">
      <Truck className="w-5 h-5 mr-2 rtl:ml-2 flex-shrink-0" /> Driver #{route.driverId}
    </h4>
    <div className="space-y-2 text-sm flex-grow">
      <p>
        <strong className="font-medium text-gray-700 dark:text-gray-300">
          Route Time / Distance:
        </strong>{" "}
        {route.distance.toFixed(1)} seconds ({formatTime(route.distance)}) /{" "}
        {route.distance.toFixed(1)} meters ({formatDistance(route.distance)})
      </p>
      <div>
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
          Route Sequence (Point IDs):
        </p>
        <p className="font-mono break-words bg-gray-100 dark:bg-gray-700/60 p-3 rounded text-xs text-gray-700 dark:text-gray-300 border dark:border-gray-600">
          {route.deliveryIds?.join(" → ") ?? "N/A (No deliveries assigned)"}
        </p>
      </div>
    </div>
  </div>
);

