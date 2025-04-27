"use client";

import RouteChart from "@/components/RouteChart";
import { API_URL, SIGNALR_URL } from "@/config/appConfig";
import {
  DriverRoute,
  OptimizationRequestData,
  OptimizationResult,
  ProgressUpdate,
} from "@/types/optimization";
import * as signalR from "@microsoft/signalr";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronsRight,
  Clock,
  Loader2,
  Map,
  MapPinned,
  Route as RouteIcon,
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
  const [minCoord, setMinCoord] = useState<number>(-1000);
  const [maxCoord, setMaxCoord] = useState<number>(1000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [logMessages, setLogMessages] = useState<ProgressUpdate[]>([]);
  const [hubConnection, setHubConnection] =
    useState<signalR.HubConnection | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Not connected");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SIGNALR_URL) {
      setError("SignalR URL missing. Real-time logs disabled.");
      setConnectionStatus("Not connected");
      return;
    }
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_URL)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();
    setHubConnection(connection);

    connection.on("ReceiveMessage", (update: ProgressUpdate) => {
      setLogMessages((prev) => {
        const item = { ...update, timestamp: Date.now() };
        if (item.clearPreviousProgress && item.style === "progress") {
          const lastProgressIndex = prev
            .map((log) => log.style)
            .lastIndexOf("progress");
          if (lastProgressIndex !== -1) {
            const updatedLogs = [...prev];
            updatedLogs[lastProgressIndex] = item;
            return updatedLogs;
          }
        }
        return [...prev, item];
      });
    });

    connection
      .start()
      .then(() => {
        setConnectionStatus("Connected");
      })
      .catch((err) => {
        console.error("SignalR Connection Error: ", err);
        setError(
          `Failed to connect to SignalR hub at ${SIGNALR_URL}. Real-time logs will be unavailable.`
        );
        setConnectionStatus("Connection Failed");
      });

    connection.onreconnecting((err) => {
      console.warn("SignalR attempting to reconnect: ", err);
      setConnectionStatus("Reconnecting");
    });

    connection.onreconnected((connectionId) => {
      console.log("SignalR reconnected with ID: ", connectionId);
      setConnectionStatus("Connected");
    });

    connection.onclose((err) => {
      console.warn("SignalR connection closed: ", err);
      if (connectionStatus !== "Connection Failed") {
        setConnectionStatus("Disconnected");
      }
    });

    return () => {
      hubConnection
        ?.stop()
        .catch((err) =>
          console.error("Error stopping SignalR connection:", err)
        );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logMessages]);

  const handleInputChange =
    (
      setter: React.Dispatch<React.SetStateAction<number>>,
      minVal: number = -Infinity,
      isInteger: boolean = true
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = isInteger
        ? parseInt(e.target.value, 10)
        : parseFloat(e.target.value);
      const val = isNaN(raw) ? (minVal > 0 ? minVal : 0) : raw;
      setter(Math.max(minVal, val));
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
          message: `SignalR not connected (State: ${
            hubConnection?.state ?? "Not Initialized"
          }). Real-time logs unavailable.`,
          style: "warning",
          timestamp: Date.now(),
        },
      ]);
    }

    if (numDeliveries <= 0 || numDrivers <= 0) {
      setError("Number of deliveries and drivers must be positive.");
      setIsLoading(false);
      return;
    }
    if (minCoord >= maxCoord) {
      setError("Minimum coordinate must be less than the maximum coordinate.");
      setIsLoading(false);
      return;
    }

    const requestData: OptimizationRequestData = {
      numberOfDeliveries: numDeliveries,
      numberOfDrivers: numDrivers,
      minCoordinate: minCoord,
      maxCoordinate: maxCoord,
    };

    if (!API_URL) {
      setError("API URL environment variable (API_URL) is not configured.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestData),
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg =
          data?.errorMessage ||
          data?.title ||
          `Server Error (${response.status}): ${response.statusText}`;
        throw new Error(errMsg);
      }

      if (!data || typeof data.bestMethod === "undefined") {
        throw new Error("Received unexpected data structure from the server.");
      }

      setResults(data as OptimizationResult);
    } catch (err: unknown) {
      let msg = "An unexpected error occurred during the API request.";
      if (err instanceof Error) {
        if (
          err.message.includes("Failed to fetch") ||
          err.message.includes("NetworkError")
        ) {
          msg = `Network Error: Unable to connect to the API at ${API_URL}. Please check if the backend server is running and accessible.`;
        } else if (
          err.message.startsWith("Server Error") ||
          err.message.startsWith("API Error:")
        ) {
          msg = err.message;
        } else if (err.message.includes("JSON at position")) {
          msg = `API Error: Failed to parse response from server. The server might be down or returning invalid data. (${err.message})`;
        } else {
          msg = `API Error: ${err.message}`;
        }
      }
      console.error("API Fetch Error:", err);
      setError(msg);
      setLogMessages((prev) => [
        ...prev,
        {
          message: msg,
          style: "error-large",
          timestamp: Date.now(),
        },
      ]);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const styleForLog = (s: string | undefined): string => {
    const base = "block py-0.5 px-1 text-sm leading-relaxed";
    switch (s) {
      case "header":
        return `${base} font-bold text-lg text-fuchsia-500 border-y border-fuchsia-600 my-2 py-1 text-center uppercase`;
      case "step-header":
        return `${base} font-semibold text-yellow-500 mt-3 mb-1`;
      case "step":
        return `${base} text-yellow-600 ml-1`;
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
        return `${base} text-red-600 dark:text-red-400 font-semibold`;
      case "error-large":
        return `${base} text-red-600 dark:text-red-400 font-bold text-lg mt-2`;
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

  const prefixForLog = (s: string | undefined): React.ReactNode | null => {
    const iconSize = "w-4 h-4 mr-1.5 flex-shrink-0";
    switch (s) {
      case "step":
        return (
          <span className="text-blue-500 dark:text-blue-400 font-bold mr-1">
            {">"}
          </span>
        );
      case "success":
        return (
          <CheckCircle
            className={`${iconSize} text-green-500 dark:text-green-400`}
          />
        );
      case "success-large":
        return (
          <CheckCircle
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
        return (
          <XCircle className={`${iconSize} text-red-500 dark:text-red-400`} />
        );
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
    if (isNaN(seconds) || seconds < 0) return "N/A";
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
    return `${(seconds / 3600).toFixed(1)} hr`;
  };

  const formatDistance = (meters: number): string => {
    if (isNaN(meters)) return "N/A";
    const absMeters = Math.abs(meters);
    if (absMeters < 1000) return `${meters.toFixed(1)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const getTotalDistance = (): number => {
    if (!results) return NaN;
    if (results.bestMethod?.includes("NN")) {
      return results.optimizedDistanceNN;
    }
    if (results.bestMethod?.includes("CWS")) {
      return results.optimizedDistanceCWS ?? NaN;
    }
    return results.optimizedDistanceCWS ?? results.optimizedDistanceNN ?? NaN;
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-8 md:p-10 bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 dark:from-gray-900 dark:via-slate-950 dark:to-black text-gray-900 dark:text-gray-100 font-sans">
      <div className="w-full max-w-7xl space-y-10">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-800 dark:text-gray-50 tracking-tight">
            Multi-Driver Route Optimization
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Optimize delivery routes for multiple drivers based on location
            data.
          </p>
          <div className="mt-2 text-sm">
            {connectionStatus === "Connected" ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                <CheckCircle className="w-3 h-3 mr-1" /> Real-time logs active
              </span>
            ) : connectionStatus === "Reconnecting" ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />{" "}
                Reconnecting...
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                <XCircle className="w-3 h-3 mr-1" /> Real-time logs inactive (
                {connectionStatus})
              </span>
            )}
          </div>
        </header>

        {/* Input Form Section */}
        <section className="w-full max-w-xl mx-auto bg-white dark:bg-slate-800/80 backdrop-blur-sm p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="numDeliveries" className="input-label">
                  <MapPinned className="input-icon" /> Number of Deliveries:
                </label>
                <input
                  type="number"
                  id="numDeliveries"
                  name="numDeliveries"
                  value={numDeliveries}
                  onChange={handleInputChange(setNumDeliveries, 1)}
                  min="1"
                  required
                  disabled={isLoading}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="numDrivers" className="input-label">
                  <Truck className="input-icon" /> Number of Drivers:
                </label>
                <input
                  type="number"
                  id="numDrivers"
                  name="numDrivers"
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
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center font-medium"
                aria-expanded={showAdvanced}
              >
                <Settings className="inline-block w-4 h-4 mr-1" /> Advanced
                Settings {showAdvanced ? "▼" : "▶"}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t dark:border-gray-600 pt-4 animate-fade-in-fast">
                  <div>
                    <label htmlFor="minCoord" className="input-label">
                      Min Coordinate (meters):
                    </label>
                    <input
                      type="number"
                      id="minCoord"
                      name="minCoord"
                      value={minCoord}
                      onChange={handleInputChange(
                        setMinCoord,
                        -Infinity,
                        false
                      )}
                      step="any"
                      required
                      disabled={isLoading}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxCoord" className="input-label">
                      Max Coordinate (meters):
                    </label>
                    <input
                      type="number"
                      id="maxCoord"
                      name="maxCoord"
                      value={maxCoord}
                      onChange={handleInputChange(
                        setMaxCoord,
                        -Infinity,
                        false
                      )}
                      step="any"
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
              className={`w-full flex items-center justify-center px-6 py-3 font-semibold rounded-lg text-white transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-blue-500 ${
                isLoading
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 dark:active:bg-blue-700 transform hover:scale-[1.02] shadow-md"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />{" "}
                  Optimizing...
                </>
              ) : (
                <>
                  <RouteIcon className="h-5 w-5 mr-2" /> Calculate Optimal
                  Routes
                </>
              )}
            </button>
          </form>
        </section>

        {/* Error Display Section */}
        {error && (
          <section
            className="w-full max-w-4xl mx-auto my-6 p-4 bg-red-100 dark:bg-red-900/70 border-l-4 border-red-500 dark:border-red-600 text-red-800 dark:text-red-100 rounded-md shadow animate-fade-in"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start">
              <AlertTriangle className="h-6 w-6 mr-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-grow">
                <p className="font-bold text-lg">Error Occurred</p>
                <p className="text-sm mt-1 break-words">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-4 p-1 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 focus:outline-none focus:ring-1 focus:ring-red-500 rounded"
                aria-label="Dismiss error"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* Log Display Section */}
        {(isLoading || logMessages.length > 0) && (
          <section className="w-full max-w-4xl mx-auto my-6 animate-fade-in">
            <h3 className="text-xl md:text-2xl font-semibold mb-3 text-center text-gray-800 dark:text-gray-200 flex items-center justify-center">
              <Terminal className="w-6 h-6 mr-2" /> Optimization Log
            </h3>
            {/* Log container that grows to show all messages without a fixed height */}
            <div className="min-h-[12rem] bg-gray-950 dark:bg-black border border-gray-700 dark:border-gray-600 rounded-lg shadow-inner p-4 font-mono text-sm">
              {logMessages.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start ${styleForLog(log.style)}`}
                >
                  {prefixForLog(log.style) && (
                    <span className="flex-shrink-0 w-5 text-center pt-0.5">
                      {prefixForLog(log.style)}
                    </span>
                  )}
                  <span
                    className={`flex-grow break-words whitespace-pre-wrap ${
                      !prefixForLog(log.style) ? "ml-5" : ""
                    }`}
                  >
                    {log.message ?? ""}
                  </span>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center mt-2 pl-5">
                  <Loader2 className="animate-spin h-4 w-4 mr-2 text-blue-400" />
                  <span className="text-sm text-gray-400 italic">
                    Processing...
                  </span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        )}

        {/* Results Section */}
        {results && !isLoading && !error && (
          <section className="w-full mt-8 animate-fade-in space-y-10">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
              Optimization Results Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 text-left">
              <StatCard
                icon={CheckCircle}
                title="Best Method Found"
                value={results.bestMethod || "N/A"}
              />
              <StatCard
                icon={Clock}
                title="Longest Driver Time (Makespan)"
                value={`${(results.minMakespan ?? 0).toFixed(
                  1
                )} s (${formatTime(results.minMakespan ?? 0)})`}
              />
              <StatCard
                icon={Map}
                title="Total Distance Covered"
                value={`${getTotalDistance().toFixed(1)} m (${formatDistance(
                  getTotalDistance()
                )})`}
              />
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
                    .sort((a, b) => (a.driverId ?? 0) - (b.driverId ?? 0))
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
                    No driver routes were generated or available in the results.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        .input-label {
          @apply block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300;
        }
        .input-icon {
          @apply inline-block w-4 h-4 mr-1 align-text-bottom;
        }
        .input-field {
          @apply w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/80 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed;
          -webkit-appearance: textfield;
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
            transform: translateY(8px);
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
}

function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center space-x-4 group relative hover:shadow-lg transition-shadow duration-200">
      <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
        <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5">
          {title}
        </p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-words">
          {value}
        </p>
      </div>
    </div>
  );
}

interface DriverRouteCardProps {
  route: DriverRoute;
  formatTime: (seconds: number) => string;
  formatDistance: (meters: number) => string;
}

function DriverRouteCard({
  route,
  formatTime,
  formatDistance,
}: DriverRouteCardProps) {
  // Just showing route stats in a simple way
  const routeTime = route.distance ?? 0;
  const routeDist = route.distance ?? 0;

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300 ease-in-out flex flex-col">
      <h4 className="flex items-center font-semibold text-lg mb-3 text-blue-700 dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2">
        <Truck className="w-5 h-5 mr-2 flex-shrink-0" /> Driver #
        {route.driverId ?? "N/A"}
      </h4>
      <div className="space-y-2 text-sm flex-grow">
        <p>
          <strong className="font-medium text-gray-700 dark:text-gray-300">
            Route Time:
          </strong>{" "}
          {routeTime.toFixed(1)} s ({formatTime(routeTime)})
        </p>
        <p>
          <strong className="font-medium text-gray-700 dark:text-gray-300">
            Route Distance:
          </strong>{" "}
          {routeDist.toFixed(1)} m ({formatDistance(routeDist)})
        </p>
        <div>
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
            Route Sequence (Point IDs):
          </p>
          <p className="font-mono break-words bg-gray-100 dark:bg-gray-700/60 p-3 rounded text-xs text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-600">
            0 → {route.deliveryIds?.join(" → ") ?? "N/A"} → 0
          </p>
        </div>
      </div>
    </div>
  );
}
