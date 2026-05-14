"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { formatNaira } from "@/lib/format";
import type { RevenueTrendPoint } from "@/lib/api/owner";

export default function RevenueChart({ data }: { data: RevenueTrendPoint[] }) {
  return (
    <div className="h-[220px]">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8C24" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#FF8C24" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month_label"
            stroke="#52526A"
            tickLine={false}
            axisLine={false}
            style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
          <YAxis
            stroke="#52526A"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₦${(Number(v) / 1000).toFixed(0)}k`}
            style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#1A1A22",
              border: "1px solid #2A2A36",
              borderRadius: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#8E8EA8" }}
            formatter={(v) => [formatNaira(String(v)), "Gross"]}
          />
          <Area
            type="monotone"
            dataKey="gross_total"
            stroke="#FF8C24"
            strokeWidth={1.5}
            fill="url(#spark)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
