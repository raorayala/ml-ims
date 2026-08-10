"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConsumptionReport } from "@/lib/api";

export function ConsumptionChart({ report }: { report: ConsumptionReport | null }) {
  const data =
    report?.groups.slice(0, 8).map((g) => ({
      name: g.label,
      consumed: Number(g.totalConsumed.toFixed(2)),
    })) ?? [];

  return (
    <div className="h-72 w-full">
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
          No consumption data in this window.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#c9d6ce" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="consumed" fill="#1f7a54" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
