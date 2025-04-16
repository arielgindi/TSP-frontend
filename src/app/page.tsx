"use client";

import RouteChart from "@/components/RouteChart";
import {
  DriverRoute,
  OptimizationRequestData,
  OptimizationResult,
  ProgressUpdate
} from "@/types/optimization"; // Use updated types path if necessary
import * as signalR from "@microsoft/signalr"; // Import SignalR
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronsRight,
  Loader2,
  MapPinned,
  Route,
  Settings,
  Star,
  Terminal,
  Truck,
  XCircle
} from "lucide-react"; // Added more icons
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

export default function Home() {
  // --- State Variables (Keep as before) ---
  const [numDeliveries, setNumDeliveries] = useState<number>(30);
  const [numDrivers, setNumDrivers] = useState<number>(4);
  const [minCoord, setMinCoord] = useState<number>(-10000);
  const [maxCoord, setMaxCoord] = useState<number>(10000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  // SignalR State
  const [logMessages, setLogMessages] = useState<ProgressUpdate[]>([]);
  const [hubConnection, setHubConnection] =
    useState<signalR.HubConnection | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling logs

  // --- SignalR Connection Effect (Keep as before) ---
  useEffect(() => {
    const signalrUrl = process.env.NEXT_PUBLIC_SIGNALR_URL;
    if (!signalrUrl) {
      console.error(
        "Critical Error: SignalR Hub URL is not defined in environment (NEXT_PUBLIC_SIGNALR_URL). Real-time updates disabled."
      );
      setError(
        "Configuration Error: SignalR Hub URL is missing. Real-time logs will not work."
      );
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(signalrUrl)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
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
      .then(() => console.log("SignalR Connected successfully."))
      .catch((err) => {
        console.error("SignalR Connection Error: ", err);
        setError(
          `Failed to connect to real-time log feed at ${signalrUrl}. Check if the backend is running and the URL is correct.`
        );
      });

    return () => {
      connection.stop().then(() => console.log("SignalR Disconnected."));
    };
  }, []);

  // --- Scroll to bottom of logs (Keep as before) ---
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logMessages]);

  // --- Form Input Handler (Keep as before) ---
  const handleInputChange =
    (
      setter: React.Dispatch<React.SetStateAction<number>>,
      minVal: number = -Infinity
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setter(
        Math.max(
          minVal,
          parseInt(e.target.value, 10) || (minVal > 0 ? minVal : 0)
        )
      );
    };

  // --- Form Submit Handler (Keep as before) ---
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);
    setLogMessages([]); // Clear previous logs

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
      // Proceeding without logs, but logged the error
    }

    if (numDeliveries <= 0 || numDrivers <= 0) {
      setError("Please enter positive numbers for deliveries and drivers.");
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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError(
        "Critical Error: API URL is not defined in environment (NEXT_PUBLIC_API_URL)."
      );
      setIsLoading(false);
      return;
    }

    try {
      console.log(`Sending optimization request to ${apiUrl}`);
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

      console.log("Optimization results received:", data);
      setResults(data);
    } catch (err: unknown) {
      console.error("Optimization API call failed:", err);
      if (err instanceof Error) {
        if (
          err.message.includes("Failed to fetch") ||
          err.message.includes("NetworkError")
        ) {
          setError(
            `Failed to connect to the API server at ${apiUrl}. Please ensure the server is running, the URL is correct in .env.local, and there are no network or CORS issues.`
          );
        } else {
          setError(
            `An error occurred communicating with the server: ${err.message}`
          );
        }
        setLogMessages((prev) => [
          ...prev,
          {
            message: `API Error: ${err.message}`,
            style: "error",
            timestamp: Date.now(),
          },
        ]);
      } else {
        setError("An unknown error occurred while sending the request.");
        setLogMessages((prev) => [
          ...prev,
          {
            message: "An unknown error occurred.",
            style: "error",
            timestamp: Date.now(),
          },
        ]);
      }
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Updated Log Message Styling Helper ---
  const getLogStyleClasses = (style: string): string => {
    const base = "block py-0.5 px-1 text-sm leading-relaxed"; // Base styles
    switch (style) {
      // Mimicking Magenta headers/separators
      case "header":
        return `${base} font-bold text-lg text-fuchsia-600 dark:text-fuchsia-400 border-y-2 border-fuchsia-500 dark:border-fuchsia-500 my-2 py-1 text-center tracking-widest uppercase`;
      // Mimicking Bright Yellow section headers
      case "step-header":
        return `${base} font-semibold text-yellow-600 dark:text-yellow-400 mt-3 mb-1`;
      // Mimicking Blue Arrow > + Bright Yellow Step Text
      case "step":
        return `${base} text-yellow-600 dark:text-yellow-400 ml-1`; // Indent step text slightly
      // Mimicking White/Default info
      case "info":
        return `${base} text-gray-800 dark:text-gray-200`;
      // Mimicking Gray details/timing
      case "detail":
        return `${base} text-gray-500 dark:text-gray-400 ml-5`; // Indent details more
      // Mimicking Bright Cyan route lists
      case "detail-mono":
        return `${base} text-cyan-600 dark:text-cyan-400 font-mono ml-5`; // Monospace for IDs/routes
      // Mimicking Green Check + White Success
      case "success":
        return `${base} text-green-700 dark:text-green-400`; // Icon added separately
      case "success-large":
        return `${base} text-green-700 dark:text-green-400 font-bold text-lg mt-2`; // Icon added separately
      // Mimicking Yellow Warn
      case "warning":
        return `${base} text-amber-700 dark:text-amber-400`; // Icon added separately
      // Mimicking Red Error
      case "error":
        return `${base} text-red-700 dark:text-red-500 font-semibold`; // Icon added separately
      case "error-large":
        return `${base} text-red-700 dark:text-red-500 font-bold text-lg mt-2`; // Icon added separately
      // Mimicking Bright Blue results/values
      case "result":
        return `${base} text-blue-700 dark:text-blue-400`; // Often used with * prefix
      // Mimicking Gray italic progress
      case "progress":
        return `${base} text-gray-500 dark:text-gray-400 italic ml-5`;
      case "debug":
        return `${base} text-xs text-gray-400 dark:text-gray-500 italic`;
      default:
        return `${base} text-gray-800 dark:text-gray-200`;
    }
  };

  // --- Helper to get Prefix Icon/Text ---
  const getLogPrefix = (style: string): React.ReactNode => {
    switch (style) {
      case "step":
        return (
          <span className="text-blue-500 dark:text-blue-400 font-bold mr-1">
            {">"}
          </span>
        ); // Blue arrow mimic
      case "success":
      case "success-large":
        return (
          <Check className="inline-block w-4 h-4 mr-1.5 text-green-500 dark:text-green-400 flex-shrink-0" />
        ); // Green Check
      case "warning":
        return (
          <AlertCircle className="inline-block w-4 h-4 mr-1.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
        ); // Yellow Warn !
      case "error":
      case "error-large":
        return (
          <XCircle className="inline-block w-4 h-4 mr-1.5 text-red-500 dark:text-red-400 flex-shrink-0" />
        ); // Red X
      case "result":
        return (
          <Star className="inline-block w-3 h-3 mr-1.5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
        ); // Yellow Star * Mimic
      case "detail":
        return (
          <span className="inline-block mr-1.5 text-gray-400 dark:text-gray-500 flex-shrink-0">
            *
          </span>
        ); // Gray Star * Mimic
      case "detail-mono":
        return (
          <ChevronsRight className="inline-block w-4 h-4 mr-1.5 text-cyan-500 dark:text-cyan-400 flex-shrink-0" />
        ); // Cyan arrow for routes
      // Headers, info, progress etc don't need a prefix in this style
      default:
        return null;
    }
  };

  // --- Main Render (Input form and Results sections are mostly the same, only Log Display changes significantly) ---
  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-8 md:p-10 bg-gradient-to-br from-gray-100 via-blue-50 to-gray-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-7xl space-y-10">
        {/* --- Header (Translated) --- */}
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-gray-800 dark:text-gray-100 tracking-tight">
            Multi-Driver Route Optimization
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Enter parameters to get optimized routes for your drivers.
          </p>
        </header>

        {/* --- Input Form (Translated & unchanged functionally) --- */}
        <section className="w-full max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          {/* ... Form elements ... (keep as before) */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label
                  htmlFor="numDeliveries"
                  className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                >
                  <MapPinned className="inline-block w-4 h-4 mr-1 align-text-bottom" />{" "}
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
                  <Truck className="inline-block w-4 h-4 mr-1 align-text-bottom" />{" "}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t dark:border-gray-700 pt-4 animate-fade-in-fast">
                  <div>
                    <label
                      htmlFor="minCoord"
                      className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                    >
                      Min Coordinate (X/Y):
                    </label>
                    <input
                      type="number"
                      id="minCoord"
                      value={minCoord}
                      onChange={handleInputChange(setMinCoord)}
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
                      Max Coordinate (X/Y):
                    </label>
                    <input
                      type="number"
                      id="maxCoord"
                      value={maxCoord}
                      onChange={handleInputChange(setMaxCoord)}
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
                  Calculating Routes...
                </>
              ) : (
                <>
                  <Route className="h-5 w-5 mr-2" />
                  Calculate Optimal Routes
                </>
              )}
            </button>
          </form>
        </section>

        {/* --- Error Display (Translated & unchanged functionally) --- */}
        {error && (
          <section
            className="w-full max-w-4xl mx-auto my-6 p-4 bg-red-100 dark:bg-red-900/60 border-l-4 border-red-500 dark:border-red-600 text-red-800 dark:text-red-100 rounded-md shadow"
            role="alert"
          >
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 mr-3 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-grow">
                <p className="font-bold text-lg">Oops, an error occurred</p>
                <p className="text-sm mt-1 break-words">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-4 p-1 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 focus:outline-none"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* --- UPDATED Log Display Area --- */}
        {(isLoading || logMessages.length > 0) && (
          <section className="w-full max-w-4xl mx-auto my-6">
            <h3 className="text-xl md:text-2xl font-semibold mb-3 text-center text-gray-800 dark:text-gray-200 flex items-center justify-center">
              {/* Use Terminal Icon for Log */}
              <Terminal className="w-6 h-6 mr-2" /> Optimization Log
            </h3>
            {/* Use bg-black or near-black for console feel */}
            <div className="h-96 overflow-y-auto bg-gray-900 dark:bg-black border border-gray-700 dark:border-gray-600 rounded-lg shadow-inner p-4 font-mono text-sm">
              {logMessages.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start ${getLogStyleClasses(
                    log.style
                  )}`}
                >
                  {/* Render Prefix Icon/Text */}
                  <span className="flex-shrink-0 w-5 text-center">
                    {getLogPrefix(log.style)}
                  </span>
                  {/* Render Message */}
                  <span className="flex-grow break-words whitespace-pre-wrap">
                    {log.message}
                  </span>
                  {/* Render Optional Data like Time */}
                  {log.data?.Time && (
                    <span className="text-gray-500 dark:text-gray-600 ml-2 whitespace-nowrap">
                      ({log.data.Time})
                    </span>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
              {/* Simplified Loading indicator at the bottom */}
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

        {/* --- Results Display (Translated & unchanged functionally) --- */}
        {results && !isLoading && !error && (
          // ... Results sections (StatCards, RouteChart, DriverRouteCards) ... keep as before
          <section className="w-full mt-8 animate-fade-in space-y-10">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
              Optimization Results
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 text-left">
              {" "}
              {/* Changed text-center to text-left */}
              <StatCard
                icon={CheckCircle}
                title="Best Method Found"
                value={results.bestMethod}
              />
              <StatCard
                icon={Route}
                title="Minimum Makespan"
                value={`${results.minMakespan.toFixed(2)} units`}
              />
              <StatCard
                icon={MapPinned}
                title="Optimized Total Distance"
                value={`${(results.bestMethod.includes("NN")
                  ? results.optimizedDistanceNN
                  : results.optimizedDistanceGI
                ).toFixed(2)} units`}
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
              <div className="space-y-6">
                {(results.driverRoutes ?? []).length > 0 ? (
                  results.driverRoutes.map((route) => (
                    <DriverRouteCard key={route.driverId} route={route} />
                  ))
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                    No driver routes to display.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
      {/* --- Global Styles (Unchanged) --- */}
      <style jsx global>{`
        .input-field {
          @apply w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm;
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

// --- Helper Components (Translated & unchanged functionally) ---
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon }) => (
  // ... StatCard implementation ... keep as before
  <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center space-x-4 rtl:space-x-reverse">
    <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5">
        {title}
      </p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  </div>
);

interface DriverRouteCardProps {
  route: DriverRoute;
}
const DriverRouteCard: React.FC<DriverRouteCardProps> = ({ route }) => (
  // ... DriverRouteCard implementation ... keep as before
  <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300 ease-in-out">
    <h4 className="flex items-center font-semibold text-lg mb-3 text-blue-700 dark:text-blue-400 border-b dark:border-gray-600 pb-2">
      <Truck className="w-5 h-5 mr-2 rtl:ml-2" /> Driver #{route.driverId}
    </h4>
    <div className="space-y-2 text-sm">
      <p>
        <strong className="font-medium text-gray-700 dark:text-gray-300">
          Distance:
        </strong>{" "}
        {route.distance.toFixed(2)} units
      </p>
      <div>
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
          Route (Point IDs):
        </p>
        <p className="font-mono break-words bg-gray-100 dark:bg-gray-700/50 p-3 rounded text-xs text-gray-700 dark:text-gray-300 border dark:border-gray-600">
          {route.deliveryIds?.join(" → ") ?? "N/A"}
        </p>
      </div>
    </div>
  </div>
);
