"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DepartmentPoint = { department: string; percentage: number; employees: number };

const colorFor = (percentage: number) => {
  if (percentage >= 85) return "#10b981";
  if (percentage >= 60) return "#f59e0b";
  return "#e11d48";
};

export default function DepartmentBarChart({ data }: { data: DepartmentPoint[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-xs text-slate-500">No departments to show.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="department" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            formatter={(value) => [`${value}%`, "Present today"]}
          />
          <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
            {data.map((point) => (
              <Cell key={point.department} fill={colorFor(point.percentage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
