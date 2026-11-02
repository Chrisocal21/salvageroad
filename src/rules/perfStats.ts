// Frame-time statistics for the performance baseline. Plain numbers in, plain numbers out.

export interface FrameSummary {
  frames: number;
  avgMs: number;
  avgFps: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  /** Frame rate of the slowest 1 percent of frames. The number that shows stutter. */
  onePercentLowFps: number;
  /** How many frames took more than 20 ms, which is a visible hitch at 60 fps. */
  hitches: number;
}

export function summarizeFrames(frameMs: number[]): FrameSummary {
  if (frameMs.length === 0) {
    return { frames: 0, avgMs: 0, avgFps: 0, medianMs: 0, p95Ms: 0, p99Ms: 0, worstMs: 0, onePercentLowFps: 0, hitches: 0 };
  }
  const sorted = [...frameMs].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const avgMs = frameMs.reduce((s, v) => s + v, 0) / frameMs.length;
  const p99Ms = at(0.99);
  return {
    frames: frameMs.length,
    avgMs,
    avgFps: 1000 / avgMs,
    medianMs: at(0.5),
    p95Ms: at(0.95),
    p99Ms,
    worstMs: sorted[sorted.length - 1],
    onePercentLowFps: 1000 / p99Ms,
    hitches: frameMs.filter((v) => v > 20).length,
  };
}
