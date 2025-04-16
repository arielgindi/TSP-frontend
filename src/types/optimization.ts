export interface Delivery {
    id: number;
    x: number;
    y: number;
}

export interface DriverRoute {
    driverId: number;
    routePoints: Delivery[];
    deliveryIds: number[];
    distance: number;
    originalIndices: number[];
}

export interface OptimizationResult {
    bestMethod: string;
    generatedDeliveries: Delivery[];
    optimizedRoute: Delivery[];
    bestCutIndices: number[] | null;
    minMakespan: number;
    driverRoutes: DriverRoute[];
    initialDistanceNN: number;
    optimizedDistanceNN: number;
    initialDistanceGI: number;
    optimizedDistanceGI: number;
    combinationsCheckedNN: number;
    combinationsCheckedGI: number;
    errorMessage: string | null; // Expect this from backend on error
    totalExecutionTimeMs: number;
    pathExecutionTimeMs?: number; // This was added to the path result in backend refactor
}

export interface OptimizationRequestData {
    numberOfDeliveries: number;
    numberOfDrivers: number;
    minCoordinate?: number;
    maxCoordinate?: number;
}

// --- Added ProgressUpdate Type ---
export interface ProgressUpdate {
    step?: string;
    message: string;
    style: string; // e.g., "header", "info", "success", "warning", "detail", "result", "debug", "error", "progress", "step", "step-header", "detail-mono", "success-large", "error-large"
    data?: any;
    clearPreviousProgress?: boolean;
    timestamp?: number; // Optional: Add timestamp on frontend for sorting/display if needed
}