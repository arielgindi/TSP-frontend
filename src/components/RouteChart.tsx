"use client";

import { Delivery, DriverRoute } from "@/types/optimization"; // Use updated types path if necessary
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
} from "chart.js";
import React from "react";
import { Chart } from "react-chartjs-2";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface RouteChartProps {
  deliveries: Delivery[];
  driverRoutes: DriverRoute[];
}

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
      <div className="flex items-center justify-center h-96 md:h-[550px] bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg shadow-inner border border-gray-200 dark:border-gray-700">
        {/* Translated Text */}
        <p className="text-center text-gray-500 dark:text-gray-400">
          Enter parameters and click "Calculate Routes" to display the chart.
        </p>
      </div>
    );
  }

  const datasets = [];
  const deliveryPointsData = deliveries
    .filter((d) => d?.id !== 0)
    .map((d) => ({ x: d!.x, y: d!.y }));
  const depotPoint = deliveries.find((d) => d?.id === 0);

  datasets.push({
    type: "scatter" as const,
    // Translated Label
    label: "Delivery Points",
    data: deliveryPointsData,
    backgroundColor: "rgba(75, 192, 192, 0.7)",
    borderColor: "rgba(75, 192, 192, 1)",
    pointRadius: 5,
    pointHoverRadius: 8,
    order: 2,
  });

  if (depotPoint) {
    datasets.push({
      type: "scatter" as const,
      // Translated Label
      label: "Depot",
      data: [{ x: depotPoint.x, y: depotPoint.y }],
      backgroundColor: "rgba(255, 99, 132, 0.9)",
      borderColor: "rgba(255, 99, 132, 1)",
      pointRadius: 8,
      pointHoverRadius: 10,
      order: 3,
    });
  }

  driverRoutes.forEach((route, index) => {
    if (route?.routePoints && route.routePoints.length > 1) {
      const routeLineData = route.routePoints.map((p) =>
        p ? { x: p.x, y: p.y } : { x: 0, y: 0 }
      );
      datasets.push({
        type: "line" as const,
        // Translated Label
        label: `Driver ${route.driverId}`,
        data: routeLineData,
        borderColor: routeColors[index % routeColors.length],
        backgroundColor: "rgba(0, 0, 0, 0)",
        borderWidth: 3,
        tension: 0.1,
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
        // Translated Title
        title: { display: true, text: "X Coordinate", font: { size: 14 } },
        grid: { color: "rgba(200, 200, 200, 0.15)" },
        ticks: { color: "#6b7280", precision: 0 },
      },
      y: {
        type: "linear",
        // Translated Title
        title: { display: true, text: "Y Coordinate", font: { size: 14 } },
        grid: { color: "rgba(200, 200, 200, 0.15)" },
        ticks: { color: "#6b7280", precision: 0 },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          boxWidth: 10,
          filter: (legendItem) => {
            const dataset = data.datasets[legendItem.datasetIndex as any];
            return dataset?.type === "line";
          },
        },
      },
      tooltip: {
        enabled: true,
        mode: "nearest",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
        padding: 10,
        caretPadding: 10,
        cornerRadius: 4,
        displayColors: false,
        callbacks: {
          title: (tooltipItems: TooltipItem<any>[]) => {
            const item = tooltipItems[0];
            if (!item) return "";
            const datasetIndex = item.datasetIndex;
            const dataIndex = item.dataIndex;
            const dataset = data.datasets[datasetIndex];
            const pointData = (dataset?.data as { x: number; y: number }[])?.[
              dataIndex
            ];

            if (dataset?.type === "scatter" && pointData) {
              const originalPoint = deliveries.find(
                (d) => d?.x === pointData.x && d?.y === pointData.y
              );
              if (originalPoint) {
                // Translated Text
                return originalPoint.id === 0
                  ? "Depot"
                  : `Point #${originalPoint.id}`;
              }
            } else if (dataset?.type === "line") {
              const driverRoute = driverRoutes.find((dr) =>
                dataset.label?.includes(`Driver ${dr.driverId}`)
              );
              if (driverRoute) {
                // Translated Text
                return `Driver ${
                  driverRoute.driverId
                } (Distance: ${driverRoute.distance.toFixed(2)})`;
              }
            }
            return dataset?.label || "";
          },
          label: (context: TooltipItem<any>) => {
            const point = context.parsed;
            return point !== null
              ? `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`
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
      duration: 500,
    },
  };

  return (
    <div className="relative h-96 w-full md:h-[550px] bg-white dark:bg-gray-800/90 p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
      <Chart type="scatter" options={options} data={data} />
    </div>
  );
};

export default RouteChart;
