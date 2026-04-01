"use client";

import { area, curveMonotoneX, line, max, scaleLinear, scalePoint } from "d3";
import { useId } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { SalesTrendPoint } from "@/features/admin/services/admin-sales";

interface SalesTrendChartProps {
  readonly points: readonly SalesTrendPoint[];
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 320;
const CHART_MARGIN = { top: 20, right: 16, bottom: 42, left: 56 } as const;

function formatCompactValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function SalesTrendChart({ points }: SalesTrendChartProps) {
  const gradientId = useId();
  const chartTitleId = `${gradientId}-title`;
  const { formatPrice, convertPrice } = useCurrency();

  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">No recent sales trend available.</p>
    );
  }

  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const revenueMax = max(points, (point) => point.revenue) ?? 0;
  const ordersMax = max(points, (point) => point.orders) ?? 0;
  const safeRevenueMax = revenueMax > 0 ? revenueMax : 1;
  const safeOrdersMax = ordersMax > 0 ? ordersMax : 1;

  const xScale = scalePoint<string>()
    .domain(points.map((point) => point.label))
    .range([CHART_MARGIN.left, CHART_MARGIN.left + innerWidth])
    .padding(0.5);

  const revenueScale = scaleLinear()
    .domain([0, safeRevenueMax * 1.15])
    .range([CHART_MARGIN.top + innerHeight, CHART_MARGIN.top]);

  const ordersScale = scaleLinear()
    .domain([0, safeOrdersMax * 1.2])
    .range([CHART_MARGIN.top + innerHeight, CHART_MARGIN.top]);

  const revenueArea = area<SalesTrendPoint>()
    .x((point) => xScale(point.label) ?? 0)
    .y0(CHART_MARGIN.top + innerHeight)
    .y1((point) => revenueScale(point.revenue))
    .curve(curveMonotoneX);

  const revenueLine = line<SalesTrendPoint>()
    .x((point) => xScale(point.label) ?? 0)
    .y((point) => revenueScale(point.revenue))
    .curve(curveMonotoneX);

  const ordersLine = line<SalesTrendPoint>()
    .x((point) => xScale(point.label) ?? 0)
    .y((point) => ordersScale(point.orders))
    .curve(curveMonotoneX);

  const revenueTicks = revenueScale.ticks(4);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Revenue Pulse
          </h3>
          <p className="text-sm text-slate-500">
            Last 7 days of completed sales activity.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            <span>Revenue</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-cyan-600"
              aria-hidden="true"
            />
            <span>Orders</span>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full"
        aria-labelledby={chartTitleId}
      >
        <title id={chartTitleId}>
          Seven day sales trend showing revenue and order volume
        </title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {revenueTicks.map((tick) => {
          const y = revenueScale(tick);

          return (
            <g key={tick}>
              <line
                x1={CHART_MARGIN.left}
                x2={CHART_WIDTH - CHART_MARGIN.right}
                y1={y}
                y2={y}
                className="stroke-slate-200"
                strokeDasharray="4 6"
              />
              <text
                x={CHART_MARGIN.left - 12}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px]"
              >
                {formatCompactValue(convertPrice(tick))}
              </text>
            </g>
          );
        })}

        <path d={revenueArea(points) ?? ""} fill={`url(#${gradientId})`} />
        <path
          d={revenueLine(points) ?? ""}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
        />
        <path
          d={ordersLine(points) ?? ""}
          fill="none"
          stroke="#0891b2"
          strokeWidth="2.5"
          strokeDasharray="7 6"
        />

        {points.map((point) => {
          const x = xScale(point.label) ?? 0;
          const revenueY = revenueScale(point.revenue);
          const ordersY = ordersScale(point.orders);

          return (
            <g key={point.date}>
              <circle cx={x} cy={revenueY} r="4.5" fill="#10b981">
                <title>{`${point.label}: ${formatPrice(point.revenue)} revenue`}</title>
              </circle>
              <circle cx={x} cy={ordersY} r="4" fill="#0891b2">
                <title>{`${point.label}: ${point.orders} orders`}</title>
              </circle>
              <text
                x={x}
                y={CHART_HEIGHT - 14}
                textAnchor="middle"
                className="fill-slate-500 text-[11px]"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
