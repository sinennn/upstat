"use client";

export interface SparklinePoint {
  value: number;
  /** false = a failed check — drawn as a red tick, not part of the line. */
  ok: boolean;
}

export interface SparklineProps {
  /** Oldest → newest. */
  points: SparklinePoint[];
  width?: number;
  height?: number;
  /** Accessible summary, e.g. `last 30 checks, 2 failed`. */
  label: string;
  className?: string;
}

/**
 * Sparkline — response time over the most recent checks. Successful
 * checks form the line; failed checks render as crit ticks along the
 * baseline so an outage is visible at a glance.
 */
export function Sparkline({
  points,
  width = 120,
  height = 28,
  label,
  className,
}: SparklineProps) {
  if (points.length < 2) {
    return (
      <span
        role="img"
        aria-label={label}
        className={className}
        style={{ display: "inline-block", width, height }}
      />
    );
  }
  const ok = points.filter((p) => p.ok).map((p) => p.value);
  const max = Math.max(...ok, 1);
  const min = Math.min(...ok, 0);
  const range = Math.max(max - min, 1);
  const step = width / (points.length - 1);
  const y = (v: number) => height - 3 - ((v - min) / range) * (height - 6);

  // break the line at failures so a gap reads as "no response"
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.ok) {
      current.push(`${(i * step).toFixed(1)},${y(p.value).toFixed(1)}`);
    } else if (current.length) {
      segments.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) segments.push(current.join(" "));

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      {segments.map((pts, i) =>
        pts.includes(" ") ? (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke="var(--color-series-1)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : (
          <circle
            key={i}
            cx={pts.split(",")[0]}
            cy={pts.split(",")[1]}
            r={1.5}
            fill="var(--color-series-1)"
          />
        ),
      )}
      {points.map((p, i) =>
        p.ok ? null : (
          <rect
            key={`f${i}`}
            x={i * step - 1}
            y={height - 8}
            width={2}
            height={8}
            fill="var(--color-crit)"
          />
        ),
      )}
    </svg>
  );
}
