"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ru } from "@/lib/i18n/ru";
import type { Stage } from "@/lib/domain";

export function StageFunnel({ data }: { data: Array<{ stage: Stage; count: number }> }) {
  const chartData = data.map((d) => ({ name: ru.stages[d.stage], count: d.count }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAF1F9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: "#CBD5E1" }}
            formatter={(v: number) => [`${v}`, "Решений"]}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={i === chartData.length - 1 ? "#2E6DB4" : "#12305B"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
