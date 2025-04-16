// src/components/RouteChart.tsx
// ========= START OF FILE =========
"use client";

import { Delivery, DriverRoute } from "@/types/optimization";
import {
  ChartData,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  TooltipItem,
  ScatterController,
  LineController,
  ChartDataset, // <-- IMPORT ADDED (as per user's fixed code)
  Point,        // <-- Import Point type for clarity
  TooltipModel  // <-- Import TooltipModel for callback 'this' type
} from "chart.js";
import React from "react";
import { Chart } from "react-chartjs-2";

// Register necessary Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ScatterController,
  LineController
);

// --- Props Interface ---
interface RouteChartProps {
  deliveries: Delivery[];
  driverRoutes: DriverRoute[];
}

// --- Color Palette for Routes ---
const routeColors = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
  "#F44336", "#2196F3", "#FFEB3B", "#00BCD4", "#673AB7", "#8BC34A",
  "#E91E63", "#03A9F4", "#CDDC39", "#009688", "#9C27B0", "#FF9800",
];

// Define a type for scatter data points that includes the ID
type ScatterDataPoint = Point & { id: number };

// --- Chart Component ---
export default function RouteChart({
  deliveries = [], // Default to empty array
  driverRoutes = [], // Default to empty array
}: RouteChartProps) {

  // Display placeholder if no deliveries exist
  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 md:h-[550px] bg-gray-100 dark:bg-slate-800/50 p-4 rounded-lg shadow-inner border border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-500 dark:text-gray-400 px-4">
          Enter parameters and click &quot;Calculate Optimal Routes&quot; to visualize the results here.
        </p>
      </div>
    );
  }

  // FIX APPLIED HERE: Explicitly type the datasets array.
  // This helps TypeScript understand the mixed types ('scatter', 'line') and
  // potentially complex data point structures ({x, y, id}).
  const datasets: ChartDataset<"scatter" | "line", (number | ScatterDataPoint | Point | null)[]>[] = [];

  // Find the depot (assuming ID 0)
  const depot = deliveries.find((d) => d.id === 0);

  // Prepare delivery location data (excluding depot)
  // Keep the 'id' property as it's used in tooltips
  const deliveryPointsData: ScatterDataPoint[] = deliveries
    .filter((d) => d.id !== 0) // Exclude depot
    .map((d) => ({ x: d.x, y: d.y, id: d.id })); // Include id

  // Add Delivery Locations dataset
  datasets.push({
    type: "scatter",
    label: "Delivery Locations",
    data: deliveryPointsData, // Use the data with {x, y, id}
    backgroundColor: "rgba(75, 192, 192, 0.7)",
    borderColor: "rgba(75, 192, 192, 1)",
    pointRadius: 5,
    pointHoverRadius: 8,
    order: 2, // Render above lines
  });

  // Add Depot dataset if found
  if (depot) {
    // Keep the 'id' property here too for consistency in tooltips
    const depotData: ScatterDataPoint = { x: depot.x, y: depot.y, id: 0 };
    datasets.push({
      type: "scatter",
      label: "Depot (ID: 0)",
      data: [depotData], // Use the data with {x, y, id}
      backgroundColor: "rgba(255, 99, 132, 0.9)",
      borderColor: "rgba(255, 99, 132, 1)",
      pointStyle: 'rectRot', // Make depot visually distinct
      pointRadius: 8,
      pointHoverRadius: 10,
      order: 3, // Render above deliveries
    });
  }

  // Add Driver Route Line datasets
  driverRoutes.forEach((route, index) => {
    // Ensure routePoints exists and is not empty
    if (route.routePoints && route.routePoints.length > 0) {
      // Map route points to {x, y} for the line chart
      const routeLineData: Point[] = route.routePoints.map((p) => ({ x: p.x, y: p.y }));

      datasets.push({
        type: "line",
        label: `Driver ${route.driverId ?? 'N/A'}`, // Handle potentially missing driverId
        data: routeLineData, // Line data only needs {x, y}
        borderColor: routeColors[index % routeColors.length], // Cycle through colors
        backgroundColor: "rgba(0, 0, 0, 0)", // Transparent background for lines
        borderWidth: 2.5, // Slightly thinner lines
        tension: 0.1,    // Less curve than 0.3
        pointRadius: 0, // No points on the line itself
        pointHoverRadius: 0,
        fill: false,     // Don't fill area under the line
        showLine: true,
        order: 1, // Render lines below points
      });
    }
  });

  // --- Chart Data Object ---
  const data: ChartData<"scatter" | "line", (number | ScatterDataPoint | Point | null)[]> = {
    datasets,
  };

  // --- Chart Options ---
  const options: ChartOptions<"scatter" | "line"> = {
    responsive: true,
    maintainAspectRatio: false, // Allow chart to fill container height
    scales: {
      x: {
        type: "linear",
        position: "bottom",
        title: {
          display: true,
          text: "X Coordinate (meters)",
          font: { size: 14, weight: '500' },
          color: "#9ca3af", // Use Tailwind gray-400 for dark mode compatibility
        },
        grid: { color: "rgba(200, 200, 200, 0.1)" }, // Lighter grid lines
        ticks: { color: "#9ca3af", precision: 0 },
      },
      y: {
        type: "linear",
        title: {
          display: true,
          text: "Y Coordinate (meters)",
          font: { size: 14, weight: '500' },
          color: "#9ca3af",
        },
        grid: { color: "rgba(200, 200, 200, 0.1)" },
        ticks: { color: "#9ca3af", precision: 0 },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          usePointStyle: true,
          boxWidth: 10,
          color: "#d1d5db", // Tailwind gray-300
          // Filter out the "Delivery Locations" legend item for clarity
          filter: (item) => item.text !== "Delivery Locations",
        },
      },
      tooltip: {
        enabled: true,
        mode: "nearest",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.85)", // Slightly more opaque
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 4,
        displayColors: false, // Don't show color box in tooltip
        // Prevent multiple tooltips for overlapping points (show only scatter points)
        filter: (tooltipItem: TooltipItem<"scatter" | "line">) => {
            return tooltipItem.dataset.type === 'scatter';
        },
        callbacks: {
          // FIX APPLIED HERE: Added checks for item, dataIndex, dataset, data, and point
          title: function(this: TooltipModel<"scatter" | "line">, items: TooltipItem<"scatter" | "line">[]): string | string[] {
            const item = items[0]; // Get the first tooltip item

            // --- Safety Checks ---
            if (!item || typeof item.dataIndex === 'undefined' || !item.dataset || !item.dataset.data) {
                return ""; // Return empty if essential data is missing
            }

            // Attempt to get the specific data point using the index
            const point = item.dataset.data[item.dataIndex] as ScatterDataPoint | null;

            // Check if the point exists and is an object (could be null or number otherwise)
            if (!point || typeof point !== 'object') {
                return "";
            }
            // --- End Safety Checks ---

            // Check if it's a scatter point and has an 'id' property
            if (item.dataset.type === "scatter" && typeof point.id === 'number') {
               return point.id === 0 ? "Depot" : `Point ID: ${point.id}`;
            }

            // Fallback if it's not a scatter or id is missing
            return `Location`; // Generic fallback title
          },

          // FIX APPLIED HERE: Changed return type to string | undefined and return undefined instead of null
          label: (context: TooltipItem<"scatter" | "line">): string | undefined => {
            const p = context.parsed;
            // Show coordinates only for scatter points (depot and deliveries)
            if (context.dataset.type === "scatter" && p && typeof p.x === 'number' && typeof p.y === 'number') {
              return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) meters`; // Add units
            }
            // Return undefined (satisfies 'void') for line chart tooltips or invalid points
            return undefined;
          },
        },
      },
    },
    // Optimize interactions
    interaction: {
      mode: "nearest", // Find nearest item in any direction
      axis: "xy",      // Consider both x and y axes
      intersect: false, // Trigger tooltip even if not directly hovering over point/line
    },
    // Subtle animation
    animation: {
      duration: 400, // Faster animation
      easing: 'easeOutQuad', // Smooth easing
    },
  };

  // --- Render the Chart ---
  return (
    <div className="relative h-96 w-full md:h-[550px] bg-white dark:bg-slate-900/90 p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
      {/* Use the specific type 'scatter' as the base, but allow multiple dataset types */}
      <Chart type="scatter" options={options} data={data} />
    </div>
  );
}
// ========= END OF FILE =========