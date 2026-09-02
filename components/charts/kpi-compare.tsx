"use client";

// Сравнение «до/после»: базовая выборка против пилотной по каждому KPI.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function KpiCompareChart({
  data,
}: {
  data: Array<{ name: string; baseline: number | null; pilot: number | null; unit: string }>;
}) {
  const chartData = data
    .filter((d) => d.baseline !== null || d.pilot !== null)
    .map((d) => ({
      name: d.name.length > 38 ? `${d.name.slice(0, 36)}…` : d.name,
      "Базовая выборка": d.baseline,
      Пилот: d.pilot,
      unit: d.unit,
    }));

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 210 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAF1F9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} />
          <YAxis
            type="category"
            dataKey="name"
            width={205}
            tick={{ fontSize: 10, fill: "#475569" }}
            interval={0}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: "#CBD5E1" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Базовая выборка" fill="#94A3B8" radius={[0, 2, 2, 0]} />
          <Bar dataKey="Пилот" fill="#2E6DB4" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
