"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface EarningsDataPoint {
  month: string
  amount: number
}

interface EarningsChartProps {
  data: EarningsDataPoint[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{label}</p>
      <p className="text-[#CC3A3A]">
        {new Intl.NumberFormat("ru-RU", {
          style: "currency",
          currency: "RUB",
          maximumFractionDigits: 0,
        }).format(payload[0].value)}
      </p>
    </div>
  )
}

export function EarningsChart({ data }: EarningsChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        Нет данных о заработке
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#CC3A3A" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#CC3A3A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("ru-RU", { notation: "compact" }).format(v)
          }
          className="text-muted-foreground"
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#CC3A3A"
          strokeWidth={2}
          fill="url(#earningsGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
