"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { T, axisTick, gridStroke, tooltipStyle } from "@/components/chart-tokens";

export function ValueHistoryChart({
  data,
  unit,
}: {
  data: Array<{ date: string; value: number }>;
  unit: string;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={gridStroke} />
          <XAxis dataKey="date" tick={axisTick} />
          <YAxis tick={axisTick} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ stroke: T.ruleStrong }}
            formatter={(v: number) => [`${v.toLocaleString("ru-RU")} ${unit}`, "Значение"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={T.graphite}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={{ r: 2.5, fill: T.sheet, stroke: T.graphite, strokeWidth: 1.5 }}
            activeDot={{ r: 4, fill: T.graphite }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
