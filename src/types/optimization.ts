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
    errorMessage: string | null;
    totalExecutionTimeMs: number;
    pathExecutionTimeMs?: number;
    initialDistanceCWS?: number;
    optimizedDistanceCWS?: number;
}

export interface OptimizationRequestData {
    numberOfDeliveries: number;
    numberOfDrivers: number;
    minCoordinate?: number;
    maxCoordinate?: number;
}

export interface ProgressUpdate {
    step?: string;
    message: string;
    style: string;
    data?: Record<string, unknown>;
    clearPreviousProgress?: boolean;
    timestamp?: number;
}
