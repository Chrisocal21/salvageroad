// Draws the island with its places and docks as a PNG, for checking the plan by eye.
// Run: npx vite-node tools/place-map.ts <seed> <out.png>
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { generateWorld, WORLD, groundHeight, kindAt, KIND, aridityAt, DESERT } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';

const seed = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? 'map.png';
const m = generateWorld({ ...WORLD, seed });
const plan = planPlaces(m);
const W = 1000;
const px = new Uint8Array(W * W * 3);
const set = (x: number, y: number, c: number[]) => { if (x < 0 || y < 0 || x >= W || y >= W) return; const i = (y * W + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };
const scale = WORLD.size / W;
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
  const wx = -m.half + x * scale, wz = -m.half + y * scale;
  const k = kindAt(m, wx, wz);
  const h = groundHeight(m, wx, wz);
  if (k === KIND.ocean) { const d = Math.max(0, Math.min(1, -h / 120)); set(x, y, [30 - 20 * d, 80 - 40 * d, 140 - 40 * d].map(Math.round)); continue; }
  if (k === KIND.river || k === KIND.lake) { set(x, y, [90, 150, 210]); continue; }
  // light from the north-west for relief
  const hx = groundHeight(m, wx + 20, wz) - groundHeight(m, wx - 20, wz);
  const hz = groundHeight(m, wx, wz + 20) - groundHeight(m, wx, wz - 20);
  const shade = Math.max(0.55, Math.min(1.25, 1 - (hx + hz) * 0.012));
  const dry = aridityAt(m, wx, wz) > DESERT;
  const base = dry ? [214, 186, 128] : h > 300 ? [150, 150, 145] : [96, 140, 80];
  set(x, y, base.map((v) => Math.min(255, Math.round(v * shade))));
}
const sq = (cx: number, cy: number, r: number, c: number[]) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) set(cx + x, cy + y, Math.abs(x) === r || Math.abs(y) === r ? [0, 0, 0] : c); };
const colour: Record<string, [number, number[]]> = { city: [9, [230, 40, 40]], town: [7, [250, 150, 30]], village: [5, [250, 230, 60]], industrial: [6, [140, 60, 170]], outpost: [3, [60, 220, 90]], dock: [8, [255, 255, 255]], lookout: [3, [255, 120, 200]] };
for (const p of plan.places) { const [r, c] = colour[p.kind]; sq(Math.round((p.x + m.half) / scale), Math.round((p.z + m.half) / scale), r, c); }
for (const d of plan.docks) { // a line from the yard out to the quay and past it to the sea
  for (let t = 0; t <= 400; t += 8) set(Math.round((d.shore.x + d.seaward.x * t - 0 + m.half) / scale), Math.round((d.shore.z + d.seaward.z * t + m.half) / scale), [255, 255, 255]);
}
// PNG
const raw = Buffer.alloc((W * 3 + 1) * W);
for (let y = 0; y < W; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('saved', out, plan.places.length, 'places', plan.docks.length, 'docks');
