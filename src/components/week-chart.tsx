import type { DayBucket } from "@/lib/types";
import { formatUgx } from "@/lib/money";

export function WeekChart({ days }: { days: DayBucket[] }) {
  const max = Math.max(1, ...days.flatMap((day) => [day.sales, day.cashOut]));
  const width = 320;
  const height = 120;
  const slot = width / Math.max(days.length, 1);
  const empty = days.every((day) => day.sales === 0 && day.cashOut === 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        className="w-full"
        role="img"
        aria-label="Sales and money out for the last 7 days"
      >
        {days.map((day, index) => {
          const salesH = (day.sales / max) * (height - 4);
          const outH = (day.cashOut / max) * (height - 4);
          const x = index * slot;
          return (
            <g key={day.date}>
              <rect
                x={x + 8}
                y={height - salesH}
                width={11}
                height={Math.max(salesH, 0)}
                rx={2}
                className="fill-primary"
              />
              <rect
                x={x + 22}
                y={height - outH}
                width={11}
                height={Math.max(outH, 0)}
                rx={2}
                className="fill-chart-out"
              />
              <text
                x={x + slot / 2}
                y={height + 16}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="11"
              >
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-chart-out" /> Money out
        </span>
      </div>
      {empty ? (
        <p className="mt-2 text-sm text-muted-foreground">No sales or spending in the last 7 days.</p>
      ) : (
        <ul className="sr-only">
          {days.map((day) => (
            <li key={day.date}>
              {day.label}: sales {formatUgx(day.sales)}, money out {formatUgx(day.cashOut)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
