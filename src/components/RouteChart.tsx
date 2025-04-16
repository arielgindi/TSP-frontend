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
} from "chart.js";
import React from "react";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ScatterController,
  LineController
);

interface RouteChartProps {
  deliveries: Delivery[];
  driverRoutes: DriverRoute[];
}

// Original color palette
const routeColors = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
  "#FFCD56",
  "#C9CBCF",
  "#3FC77D",
  "#E751D8",
  "#F44336",
  "#2196F3",
  "#FFEB3B",
  "#00BCD4",
  "#673AB7",
];

const RouteChart: React.FC<RouteChartProps> = ({
  deliveries = [],
  driverRoutes = [],
}) => {
  if (deliveries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 md:h-[550px] bg-gray-100 dark:bg-slate-800/50 p-4 rounded-lg shadow-inner border border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-500 dark:text-gray-400">
          Enter parameters and click "Calculate Optimal Routes" to visualize the
          results.
        </p>
      </div>
    );
  }

  const datasets = [];
  const deliveryPointsData = deliveries
    .filter((d) => d?.id !== 0)
    .map((d) => ({ x: d!.x, y: d!.y, id: d!.id })); // Keep ID for tooltip
  const depotPoint = deliveries.find((d) => d?.id === 0);

  datasets.push({
    type: "scatter" as const,
    label: "Delivery Locations",
    data: deliveryPointsData,
    backgroundColor: "rgba(75, 192, 192, 0.7)", // Original teal color
    borderColor: "rgba(75, 192, 192, 1)",
    pointRadius: 5,
    pointHoverRadius: 8,
    order: 2,
  });

  if (depotPoint) {
    datasets.push({
      type: "scatter" as const,
      label: "Depot (ID: 0)",
      data: [{ x: depotPoint.x, y: depotPoint.y, id: 0 }],
      backgroundColor: "rgba(255, 99, 132, 0.9)", // Original pink/red color
      borderColor: "rgba(255, 99, 132, 1)",
      pointRadius: 8, // Original size
      pointHoverRadius: 10,
      order: 3,
    });
  }

  driverRoutes.forEach((route, index) => {
    if (route?.routePoints && route.routePoints.length > 0) {
      const routeLineData = route.routePoints.map((p) =>
        p ? { x: p.x, y: p.y } : { x: NaN, y: NaN }
      );
      datasets.push({
        type: "line" as const,
        label: `Driver ${route.driverId}`, // Keep simple label
        data: routeLineData,
        borderColor: routeColors[index % routeColors.length],
        backgroundColor: "rgba(0, 0, 0, 0)",
        borderWidth: 3, // Original thickness
        tension: 0.1, // Original tension
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        showLine: true,
        order: 1,
      });
    }
  });

  const data: ChartData = {
    datasets: datasets as ChartData["datasets"],
  };

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "linear",
        position: "bottom",
        title: {
          display: true,
          text: "X Coordinate (meters)",
          font: { size: 14 },
          color: "#6b7280",
        }, // Updated label
        grid: { color: "rgba(200, 200, 200, 0.15)" }, // Original grid color
        ticks: { color: "#6b7280", precision: 0 }, // Use gray-500
      },
      y: {
        type: "linear",
        title: {
          display: true,
          text: "Y Coordinate (meters)",
          font: { size: 14 },
          color: "#6b7280",
        }, // Updated label
        grid: { color: "rgba(200, 200, 200, 0.15)" }, // Original grid color
        ticks: { color: "#6b7280", precision: 0 }, // Use gray-500
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          boxWidth: 10, // Original box width
          color: "#d1d5db", // Keep light legend text for dark mode
          // Original filter logic (show everything except delivery points scatter)
          filter: (legendItem) => {
            const dataset = data.datasets[legendItem.datasetIndex];
            return dataset?.label !== "Delivery Locations";
          },
        },
      },
      tooltip: {
        enabled: true,
        mode: "nearest",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)", // Original background
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 4,
        displayColors: false, // Original setting (no color boxes)
        callbacks: {
          title: (tooltipItems: TooltipItem<any>[]) => {
            const item = tooltipItems[0];
            if (!item) return "";
            const datasetIndex = item.datasetIndex;
            const dataIndex = item.dataIndex;
            const dataset = data.datasets[datasetIndex];
            const pointData = (dataset?.data as any)?.[dataIndex]; // Use any to access id

            if (dataset?.type === "scatter" && pointData) {
              return pointData.id === 0 ? "Depot" : `Point #${pointData.id}`;
            } else if (dataset?.type === "line") {
              // Find matching driver route based on label
              const driverRoute = driverRoutes.find((dr) =>
                dataset.label?.includes(`Driver ${dr.driverId}`)
              );
              if (driverRoute) {
                return `Driver ${
                  driverRoute.driverId
                } (Dist: ${driverRoute.distance.toFixed(1)} m)`; // Show distance in title
              }
            }
            return dataset?.label || "";
          },
          label: (context: TooltipItem<any>) => {
            const point = context.parsed;
            // Show only coordinates in the label body
            return point !== null
              ? `(${point.x.toFixed(1)} m, ${point.y.toFixed(1)} m)` // Updated units
              : "";
          },
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "xy",
      intersect: false,
    },
    animation: {
      duration: 500, // Original duration
    },
  };

  return (
    // Use background from page.tsx for consistency now
    <div className="relative h-96 w-full md:h-[550px] bg-white dark:bg-slate-900/90 p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
      <Chart type="scatter" options={options} data={data} />
    </div>
  );
};

export default RouteChart;
