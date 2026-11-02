import type { DriveInput } from './lab/types';
import { summarizeFrames, type FrameSummary } from './rules/perfStats';

// Automatic performance run. Press B in the game. The truck drives a circle by itself while we
// record frame times, first at normal load and then with more pixels to stand in for a weaker GPU.

export interface BenchPhase {
  name: string;
  seconds: number;
  /** Multiplies the render resolution on each side. 1.5 means 2.25x the pixels. */
  renderScale: number;
}

export const BENCH_PHASES: BenchPhase[] = [
  { name: 'normal', seconds: 12, renderScale: 1 },
  { name: '2.25x pixels', seconds: 12, renderScale: 1.5 },
  { name: '4x pixels', seconds: 12, renderScale: 2 },
  { name: '9x pixels', seconds: 12, renderScale: 3 },
];

const WARMUP_SECONDS = 1.5; // dropped at the start of each phase: shader compile and resize hitches

export interface PhaseResult {
  name: string;
  renderScale: number;
  /** Size of the image actually being drawn, to prove the extra-pixels setting took effect. */
  resolution: string;
  summary: FrameSummary;
  avgCpuMs: number;
  avgPhysicsMs: number;
  drawCalls: number;
  triangles: number;
}

export interface BenchContext {
  gpu: string;
  screen: string;
  props: number;
  terrain: string;
  basePixelRatio: number;
}

export interface BenchReport {
  context: BenchContext;
  phases: PhaseResult[];
}

/** Driving script: a steady circle in the flat area around the start, no player input needed. */
export function scriptedInput(speed: number): DriveInput {
  return { throttle: speed < 10 ? 0.7 : 0.25, steer: 0.7, brake: 0 };
}

export class Bench {
  active = false;
  report: BenchReport | null = null;

  private phase = 0;
  private phaseStart = 0;
  private frames: number[] = [];
  private cpu: number[] = [];
  private physics: number[] = [];
  private calls = 0;
  private tris = 0;
  private results: PhaseResult[] = [];

  constructor(
    private context: BenchContext,
    private setRenderScale: (scale: number) => void,
    private getResolution: () => string,
    private phases: BenchPhase[] = BENCH_PHASES,
  ) {}

  start(now: number): void {
    this.active = true;
    this.report = null;
    this.results = [];
    this.phase = 0;
    this.beginPhase(now);
  }

  cancel(): void {
    this.active = false;
    this.setRenderScale(1);
  }

  /** Seconds left in the whole run, for the on-screen countdown. */
  remaining(now: number): number {
    const done = this.phases.slice(0, this.phase).reduce((s, p) => s + p.seconds, 0);
    const total = this.phases.reduce((s, p) => s + p.seconds, 0);
    return Math.max(0, total - done - (now - this.phaseStart) / 1000);
  }

  phaseName(): string {
    return this.phases[Math.min(this.phase, this.phases.length - 1)].name;
  }

  /** Call once per frame while active. Times are in milliseconds. */
  frame(now: number, frameMs: number, cpuMs: number, physicsMs: number, calls: number, tris: number): void {
    if (!this.active) return;
    const elapsed = (now - this.phaseStart) / 1000;
    if (elapsed >= WARMUP_SECONDS) {
      this.frames.push(frameMs);
      this.cpu.push(cpuMs);
      this.physics.push(physicsMs);
      this.calls = calls;
      this.tris = tris;
    }
    if (elapsed >= this.phases[this.phase].seconds) this.endPhase(now);
  }

  private beginPhase(now: number): void {
    const p = this.phases[this.phase];
    this.setRenderScale(p.renderScale);
    this.phaseStart = now;
    this.frames = [];
    this.cpu = [];
    this.physics = [];
  }

  private endPhase(now: number): void {
    const p = this.phases[this.phase];
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    this.results.push({
      name: p.name,
      renderScale: p.renderScale,
      resolution: this.getResolution(),
      summary: summarizeFrames(this.frames),
      avgCpuMs: avg(this.cpu),
      avgPhysicsMs: avg(this.physics),
      drawCalls: this.calls,
      triangles: this.tris,
    });
    this.phase++;
    if (this.phase >= this.phases.length) {
      this.active = false;
      this.setRenderScale(1);
      this.report = { context: this.context, phases: this.results };
    } else {
      this.beginPhase(now);
    }
  }
}

const f1 = (n: number) => n.toFixed(1);

/** Plain text report, short enough to read at a glance and to paste into a message. */
export function formatReport(r: BenchReport): string {
  const c = r.context;
  const lines = [
    'PERFORMANCE RUN',
    `GPU: ${c.gpu}`,
    `Screen: ${c.screen}, pixel ratio ${c.basePixelRatio}`,
    `Scene: ${c.terrain}, ${c.props} props`,
    '',
  ];
  for (const p of r.phases) {
    const s = p.summary;
    lines.push(
      `${p.name}  (drawing ${p.resolution})`,
      `  avg ${f1(s.avgFps)} fps (${f1(s.avgMs)} ms)   1% low ${f1(s.onePercentLowFps)} fps   worst ${f1(s.worstMs)} ms   hitches over 20 ms: ${s.hitches}`,
      `  CPU ${f1(p.avgCpuMs)} ms per frame (physics ${p.avgPhysicsMs.toFixed(2)} ms)   draw calls ${p.drawCalls}   triangles ${p.triangles}`,
    );
  }
  lines.push('', 'Press B to run again, X to close this report.');
  return lines.join('\n');
}
