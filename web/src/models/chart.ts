/** Chart series — the shape TimeseriesPanel plots. */

export interface SeriesPoint {
  /** RFC3339 timestamp. */
  ts: string;
  /** null = gap (e.g. a failed check has no response time). */
  value: number | null;
}

export interface Series {
  name: string;
  tags: Record<string, string>;
  points: SeriesPoint[];
}
