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
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAF1F9" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: "#CBD5E1" }}
            formatter={(v: number) => [`${v.toLocaleString("ru-RU")} ${unit}`, "Значение"]}
          />
          <Line type="monotone" dataKey="value" stroke="#2E6DB4" strokeWidth={2} dot={{ r: 3, fill: "#12305B" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
