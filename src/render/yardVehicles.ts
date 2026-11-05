import * as THREE from 'three';
import { createRustedMaterial } from './rust';
import { createYardTire } from './yardTire';
import { VehicleGeometry, blend, lerp, quadPoint, type V3 } from './vehicleGeometry';

const STYLES = ['compact hatchback', 'stripped farm truck', 'muscle coupe', 'barn-find sports car', 'stepside pickup'];

/** Stationary scenery, built to the El Cajon's panel, trim and material conventions. */
export function createYardVehicle(index: number): THREE.Group {
  const kind = ((index % 5) + 5) % 5;
  const truck = kind === 1 || kind === 4, sports = kind === 3, muscle = kind === 2;
  const root = new THREE.Group(); root.name = STYLES[kind];
  const g = new VehicleGeometry();
  const box = g.box.bind(g), surface = g.surface.bind(g), patch = g.patch.bind(g);
  const line = g.line.bind(g), rod = g.rod.bind(g), disc = g.disc.bind(g), ring = g.ring.bind(g);
  // The same physically lit rust as the benchmark. Ground-relative bodies use a translated
  // material origin so lower panels corrode at the same height as the El Cajon chassis.
  const weathered = (type: 'paint' | 'chrome', color: number, paintColor?: number) => {
    const material = createRustedMaterial(type, color, paintColor);
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      shader.vertexShader = shader.vertexShader.replace('vRustPos = position;', `vRustPos = position + vec3(${(kind * 3.7).toFixed(2)}, -0.66, ${(kind * 1.9).toFixed(2)});`);
    };
    material.customProgramCacheKey = () => `yard-benchmark-${type}-${kind}-${color}-${paintColor}`;
    return material;
  };
  const paint = weathered('paint', 0xffffff, [0xc0c0ab, 0x744331, 0x627d7d, 0xb5b6a7, 0x466f84][kind]); paint.name = 'Body paint';
  const chrome = weathered('chrome', 0xcbd0cf); chrome.name = 'Tarnished brightwork';
  const iron = weathered('chrome', 0x686c6b); iron.name = 'Chassis and wheels';
  const trim = new THREE.MeshStandardMaterial({ color: 0x697176, metalness: 0.72, roughness: 0.42 }); trim.name = 'Window molding';
  const black = new THREE.MeshStandardMaterial({ color: 0x141819, roughness: 0.91 }); black.name = 'Seals and recesses';
  const upholstery = new THREE.MeshStandardMaterial({ color: truck ? 0x766148 : 0x574e40, roughness: 0.94 }); upholstery.name = 'Worn upholstery';
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xa8bdc2, metalness: 0.04, roughness: 0.12, transparent: true, opacity: 0.27, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }); glass.name = 'Glazing';
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xaab2ac, roughness: 0.24, metalness: 0.12, clearcoat: 1 }); lens.name = 'Headlamp lenses';
  const red = new THREE.MeshPhysicalMaterial({ color: 0x820c12, roughness: 0.28, clearcoat: 1 }); red.name = 'Tail lamp lenses';
  const amber = new THREE.MeshPhysicalMaterial({ color: 0xb96316, roughness: 0.3, clearcoat: 1 }); amber.name = 'Indicators';

  const wheelY = truck ? 0.375 : sports ? 0.33 : 0.355;
  const tireR = truck ? 0.38 : sports ? 0.335 : 0.36;
  const axles = [-1.37, 1.38];
  const end = 2.15, sill = 0.31;
  const belt = truck ? 1.02 : sports ? 0.83 : 0.98;
  const roofY = truck ? 1.60 : sports ? 1.20 : muscle ? 1.36 : 1.44;
  const roofHalf = truck ? 0.70 : sports ? 0.62 : 0.68;
  const cabinHalf = truck ? 0.83 : 0.78;
  const roofFront = truck ? 0.36 : sports ? -0.13 : muscle ? 0.30 : 0.40;
  const roofBack = truck ? -0.58 : sports ? -0.90 : -0.64;
  const windFront = truck ? 0.72 : sports ? 0.59 : 0.89;
  const windBack = truck ? -0.72 : sports ? -1.63 : muscle ? -1.65 : -1.43;
  const top = (z: number) => belt - (truck ? 0 : 0.065 * (Math.abs(z) / end) ** 5);
  const width = (y: number, z: number) => {
    const t = THREE.MathUtils.clamp((y - sill) / (belt - sill), 0, 1);
    return (truck ? 0.82 : 0.84) + 0.065 * Math.sin(t * Math.PI * 0.88) - 0.045 * (Math.abs(z) / end) ** 5;
  };
  const sidePoint = (s: number, y: number, z: number, out = 0): V3 => [s * (width(y, z) + out), y, z];
  const bottom = (z: number) => {
    let low = sill;
    for (const axle of axles) {
      const dz = z - axle, radius = tireR + 0.065;
      if (Math.abs(dz) < radius) low = Math.max(low, wheelY + Math.sqrt(radius * radius - dz * dz));
    }
    return low;
  };
  const skin = (s: number, from: number, to: number, lower: (z: number) => number) => {
    surface(paint, 128, 16, (u, v) => {
      const z = lerp(from, to, u);
      return sidePoint(s, lerp(lower(z), top(z), v), z);
    }, [s, 0, 0]);
  };

  // Continuous skins, crowned shoulders and folded returns; all edges share their equations.
  for (const s of [-1, 1]) {
    skin(s, truck ? windBack : -end, truck ? windFront : end, truck ? () => sill : bottom);
    if (!truck) {
      surface(paint, 104, 8, (u, v) => {
        const z = lerp(-end, end, u), y = top(z);
        return [s * lerp(cabinHalf, width(y, z), v), y + Math.sin(v * Math.PI) * 0.012, z];
      }, [0, 1, 0]);
      for (const axle of axles) {
        const arch: V3[] = [];
        for (let i = 0; i <= 64; i++) {
          const a = i / 64 * Math.PI, y = wheelY + Math.sin(a) * (tireR + 0.066), z = axle + Math.cos(a) * (tireR + 0.066);
          arch.push(sidePoint(s, y, z, 0.005));
        }
        line(muscle ? paint : chrome, arch, 0.007);
        surface(black, 64, 5, (u, v) => {
          const a = u * Math.PI, r = tireR + 0.066;
          const y = wheelY + Math.sin(a) * r, z = axle + Math.cos(a) * r;
          return [s * lerp(width(y, z), 0.66, v), y, z];
        }, [0, -1, 0]);
      }
    }
    const rearDoor = truck ? -0.62 : -0.62, frontDoor = truck ? 0.65 : 0.71;
    const seam: V3[] = [];
    for (let i = 0; i <= 16; i++) seam.push(sidePoint(s, lerp(top(frontDoor) - 0.004, 0.40, i / 16), frontDoor, 0.003));
    seam.push(sidePoint(s, 0.36, frontDoor - 0.07, 0.003), sidePoint(s, 0.36, rearDoor + 0.10, 0.003), sidePoint(s, 0.42, rearDoor, 0.003));
    for (let i = 0; i <= 16; i++) seam.push(sidePoint(s, lerp(0.42, top(rearDoor) - 0.005, i / 16), rearDoor, 0.003));
    line(black, seam, 0.0025);
    const handleY = belt - 0.12;
    box(black, [0.012, 0.03, 0.15], sidePoint(s, handleY, -0.39, 0.004), 0.006);
    box(chrome, [0.022, 0.017, 0.12], sidePoint(s, handleY + 0.006, -0.39, 0.015), 0.005);
    disc(trim, 0.009, 0.008, sidePoint(s, handleY - 0.045, -0.39, 0.007), 'x', 12);
    const crease = (z0: number, z1: number, y: number, material: THREE.Material, radius: number) => line(material,
      Array.from({ length: 32 }, (_, i) => sidePoint(s, y, lerp(z0, z1, i / 31), 0.004)), radius);
    crease(truck ? -0.62 : -2.02, truck ? 0.65 : 2.02, belt - 0.15, muscle ? trim : chrome, 0.004);
    crease(-0.91, 0.91, 0.36, chrome, truck ? 0.009 : 0.012);
    rod(trim, sidePoint(s, belt + 0.015, 0.58), [s * 0.98, belt + 0.10, 0.54], 0.009);
    box(chrome, [0.045, 0.083, 0.13], [s * 1.0, belt + 0.12, 0.54], 0.018);
    box(lens, [0.005, 0.062, 0.10], [s * 1.025, belt + 0.12, 0.54], 0.012);
  }
  box(black, [1.46, 0.065, truck ? 1.50 : 3.85], [0, 0.32, truck ? 0 : -0.03]);
  for (const x of [-0.48, 0.48]) box(iron, [0.085, 0.11, 4.05], [x, 0.245, 0]);
  for (const z of axles) {
    rod(iron, [-0.81, wheelY, z], [0.81, wheelY, z], 0.035);
    for (const s of [-1, 1]) {
      for (let n = 0; n < 3; n++) line(iron, [[s * 0.5, 0.30 - n * 0.012, z - 0.35], [s * 0.5, 0.25 - n * 0.012, z], [s * 0.5, 0.30 - n * 0.012, z + 0.35]], 0.009);
    }
  }

  // Bonnet and rear deck use the exact shoulder perimeter, with a closed front and rear valance.
  const hoodStart = truck ? 0.80 : windFront + 0.04;
  const hoodHalf = (z: number) => truck ? lerp(0.59, 0.51, (z - hoodStart) / (end - hoodStart)) : cabinHalf;
  const hoodY = (x: number, z: number) => truck
    ? lerp(1.065, 0.99, (z - hoodStart) / (end - hoodStart)) + 0.18 * (1 - (x / hoodHalf(z)) ** 2)
    : top(z) + 0.009 + (sports ? 0.048 : 0.025) * (1 - (x / cabinHalf) ** 2);
  surface(paint, 36, 48, (u, v) => {
    const z = lerp(hoodStart, end, v), x = (u * 2 - 1) * hoodHalf(z);
    return [x, hoodY(x, z), z];
  }, [0, 1, 0]);
  for (const s of [-1, 1]) {
    surface(paint, 48, 12, (u, v) => {
      const z = lerp(hoodStart, end, u), edge = hoodHalf(z);
      return [s * (edge + (truck ? Math.sin(v * Math.PI) * 0.025 : 0)), lerp(truck ? 0.59 : top(z), hoodY(edge, z), v), z];
    }, [s, 0, 0]);
    line(black, Array.from({ length: 40 }, (_, i) => {
      const z = lerp(hoodStart + 0.015, end - 0.015, i / 39), x = s * (hoodHalf(z) - 0.003);
      return [x, hoodY(x, z) + 0.002, z];
    }), 0.0022);
  }
  surface(paint, 36, 16, (u, v) => {
    const x = (u * 2 - 1) * hoodHalf(end);
    return [x, lerp(truck ? 0.57 : 0.34, hoodY(x, end), v), end + 0.025 * Math.sin((1 - v) * Math.PI)];
  }, [0, 0, 1]);
  surface(paint, 36, 8, (u, v) => {
    const x = (u * 2 - 1) * lerp(cabinHalf, hoodHalf(hoodStart), v);
    return [x, lerp(top(windFront), hoodY((u * 2 - 1) * hoodHalf(hoodStart), hoodStart), v), lerp(windFront, hoodStart, v)];
  }, [0, 1, 0]);
  if (truck) {
    // Firewall and closed cab back remove the old see-through gaps around the hood and seats.
    box(paint, [cabinHalf * 2, 0.68, 0.055], [0, 0.67, windFront - 0.025]);
    box(paint, [cabinHalf * 2, belt - 0.31, 0.06], [0, (belt + 0.31) / 2, windBack + 0.015]);
    for (const s of [-1, 1]) {
      // Deep, rounded pontoon fenders, with folded wheel opening edges and inner liners.
      for (const axle of axles) {
        const outerRadius = tireR + 0.18, innerRadius = tireR + 0.055;
        const fender = (a: number, v: number): V3 => [s * lerp(0.56, 0.94, v), wheelY + Math.sin(a) * (outerRadius + Math.sin(v * Math.PI) * 0.045), axle + Math.cos(a) * outerRadius];
        surface(paint, 64, 16, (u, v) => fender(u * Math.PI, v), [0, 1, 0]);
        surface(paint, 64, 12, (u, v) => {
          const a = u * Math.PI, r = lerp(innerRadius, outerRadius, v);
          return [s * (0.94 + 0.009 * Math.sin(v * Math.PI)), wheelY + Math.sin(a) * r, axle + Math.cos(a) * r];
        }, [s, 0, 0]);
        surface(black, 64, 6, (u, v) => {
          const a = u * Math.PI;
          return [s * lerp(0.65, 0.94, v), wheelY + Math.sin(a) * innerRadius, axle + Math.cos(a) * innerRadius];
        }, [0, -1, 0]);
        line(paint, Array.from({ length: 65 }, (_, i) => {
          const a = i / 64 * Math.PI; return [s * 0.945, wheelY + Math.sin(a) * innerRadius, axle + Math.cos(a) * innerRadius];
        }), 0.009);
        // Closed inner vertical skirt joins the fender to the bonnet/bed, hiding the void beneath it.
        surface(paint, 64, 8, (u, v) => {
          const a = u * Math.PI; return [s * 0.56, lerp(0.32, wheelY + Math.sin(a) * outerRadius, v), axle + Math.cos(a) * outerRadius];
        }, [-s, 0, 0]);
      }
      box(paint, [0.28, 0.055, 1.48], [s * 0.82, 0.29, -0.01], 0.018);
      for (let n = 0; n < 5; n++) box(black, [0.009, 0.004, 1.31], [s * (0.72 + n * 0.039), 0.32, -0.01], 0);
    }
    if (kind === 4) {
      box(paint, [1.40, 0.055, 1.34], [0, 0.49, -1.43]);
      for (const s of [-1, 1]) {
        box(paint, [0.055, 0.45, 1.39], [s * 0.73, 0.73, -1.43], 0.018);
        line(paint, [[s * 0.73, 0.97, -2.12], [s * 0.73, 0.97, -0.74]], 0.023);
        box(paint, [0.30, 0.23, 0.79], [s * 0.58, 0.60, -1.37], 0.07); // bed wheel tubs
      }
      box(paint, [1.46, 0.45, 0.055], [0, 0.73, -2.12], 0.015);
      line(black, [[-0.68, 0.93, -2.15], [-0.68, 0.54, -2.15], [0.68, 0.54, -2.15], [0.68, 0.93, -2.15]], 0.003);
      for (let n = -3; n <= 3; n++) box(iron, [0.022, 0.009, 1.30], [n * 0.19, 0.522, -1.43], 0);
      for (const s of [-1, 1]) box(chrome, [0.13, 0.045, 0.035], [s * 0.53, 0.85, -2.16]);
    } else {
      // Missing load bed leaves actual frame rails, crossmembers, axle and fuel tank visible.
      for (const z of [-0.91, -1.48, -2.03]) box(iron, [1.33, 0.07, 0.07], [0, 0.29, z]);
      box(iron, [0.73, 0.17, 0.56], [0, 0.36, -1.83], 0.045);
    }
  } else {
    surface(paint, 32, 24, (u, v) => {
      const z = lerp(-end, windBack, v), x = (u * 2 - 1) * cabinHalf;
      return [x, top(z) + 0.01 + 0.018 * Math.sin(u * Math.PI), z];
    }, [0, 1, 0]);
    for (const s of [-1, 1]) {
      surface(paint, 8, 8, (u, v) => {
        const x = s * lerp(cabinHalf, width(top(end), end), u);
        return [x, lerp(0.34, top(end), v), end];
      }, [0, 0, 1]);
    }
    surface(paint, 40, 20, (u, v) => {
      const y = lerp(0.32, top(-end) + 0.01, v), x = (u * 2 - 1) * width(Math.min(y, top(-end)), -end);
      return [x, y, -end - 0.025 * Math.sin(v * Math.PI)];
    }, [0, 0, -1]);
    for (const s of [-1, 1]) line(black, Array.from({ length: 20 }, (_, i) => {
      const z = lerp(-end + 0.025, windBack - 0.025, i / 19); return [s * 0.65, top(z) + 0.018, z];
    }), 0.0025);
  }

  // Pressed roof with a gentle compound crown, folded edges and a proper headliner.
  const roofCrown = (u: number, v: number) => roofY + 0.032 * Math.sin(u * Math.PI) + 0.008 * Math.sin(v * Math.PI);
  surface(paint, 32, 28, (u, v) => [(u * 2 - 1) * roofHalf, roofCrown(u, v), lerp(roofBack, roofFront, v)], [0, 1, 0]);
  for (const e of [0, 1]) surface(paint, 32, 3, (u, v) => [(u * 2 - 1) * roofHalf, lerp(roofY - 0.018, roofCrown(u, e), v), e ? roofFront : roofBack], [0, 0, e ? 1 : -1]);
  for (const s of [-1, 1]) surface(paint, 28, 3, (u, v) => [s * roofHalf, lerp(roofY - 0.018, roofCrown(0, u), v), lerp(roofBack, roofFront, u)], [s, 0, 0]);
  box(upholstery, [roofHalf * 2 - 0.06, 0.02, roofFront - roofBack - 0.025], [0, roofY - 0.025, (roofBack + roofFront) / 2]);

  // Flat mitered metal surrounds, narrow satin molding and rubber seals follow each opening.
  // All four corners meet the roof, cowl and shoulders; no freestanding cylindrical pillars.
  const window = (outer: V3[], outward: V3, inset: [number, number, number, number], broken = false) => {
    const [u0, u1, v0, v1] = inset;
    const inner = [quadPoint(outer, u0, v0), quadPoint(outer, u1, v0), quadPoint(outer, u1, v1), quadPoint(outer, u0, v1)];
    g.frame(paint, outer, inner, outward);
    const n = new THREE.Vector3(...outward).normalize().multiplyScalar(0.0015);
    const contour = (t: number): V3[] => inner.map((p, i) => {
      const v = blend(p, outer[i], t); return [v[0] + n.x, v[1] + n.y, v[2] + n.z];
    });
    g.frame(black, contour(0.13), contour(0), outward);
    g.frame(trim, contour(0.26), contour(0.13), outward);
    // The cabin-facing metal return prevents the trim from appearing paper-thin from inside.
    const inside = inner.map(p => [p[0] - n.x * 12, p[1] - n.y * 12, p[2] - n.z * 12] as V3);
    g.frame(black, inner, inside, outward);
    if (!broken) surface(glass, 22, 12, (u, v) => {
      const p = quadPoint(inner, u, v), bulge = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 4;
      return [p[0] + n.x * bulge, p[1] + n.y * bulge, p[2] + n.z * bulge];
    }, outward);
    return inner;
  };
  const frontOuter: V3[] = [[-cabinHalf, top(windFront), windFront], [cabinHalf, top(windFront), windFront], [roofHalf, roofY - 0.018, roofFront], [-roofHalf, roofY - 0.018, roofFront]];
  const rearOuter: V3[] = [[cabinHalf, top(windBack), windBack], [-cabinHalf, top(windBack), windBack], [-roofHalf, roofY - 0.018, roofBack], [roofHalf, roofY - 0.018, roofBack]];
  window(frontOuter, [0, 0.6, 1], [0.033, 0.967, 0.075, 0.925], kind === 1);
  window(rearOuter, [0, 0.4, -1], truck ? [0.17, 0.83, 0.23, 0.83] : [0.06, 0.94, 0.11, 0.90], kind === 1);
  for (const s of [-1, 1]) {
    const outer: V3[] = [[s * cabinHalf, top(windFront), windFront], [s * cabinHalf, top(windBack), windBack], [s * roofHalf, roofY - 0.018, roofBack], [s * roofHalf, roofY - 0.018, roofFront]];
    const inner = window(outer, [s, 0.2, 0], [0.045, truck ? 0.87 : sports ? 0.79 : muscle ? 0.81 : 0.87, 0.08, 0.92], kind === 1);
    if (!truck) {
      const p0 = blend(inner[0], inner[1], 0.53), p1 = blend(inner[3], inner[2], 0.53);
      patch(paint, [blend(inner[0], inner[1], 0.52), blend(inner[0], inner[1], 0.545), blend(inner[3], inner[2], 0.545), blend(inner[3], inner[2], 0.52)], [s, 0, 0]);
      line(trim, [p0, p1], 0.003);
    } else {
      // Quarter-light divider is a narrow strip, not a roll cage bar.
      patch(trim, [quadPoint(inner, 0.19, 0), quadPoint(inner, 0.205, 0), quadPoint(inner, 0.205, 1), quadPoint(inner, 0.19, 1)], [s, 0, 0]);
    }
    surface(paint, 32, 3, (u, v) => {
      const z = lerp(windBack, windFront, u), y = top(z);
      return [s * lerp(cabinHalf, width(y, z), v), y, z];
    }, [0, 1, 0]);
    line(trim, [[s * (roofHalf + 0.008), roofY - 0.011, roofBack], [s * (roofHalf + 0.008), roofY - 0.011, roofFront]], 0.004);
  }
  if (kind === 1) patch(paint, [quadPoint(frontOuter, 0.493, 0.06), quadPoint(frontOuter, 0.507, 0.06), quadPoint(frontOuter, 0.507, 0.94), quadPoint(frontOuter, 0.493, 0.94)], [0, 0.6, 1]);
  for (const x of [-0.39, 0.31]) {
    const low = quadPoint(frontOuter, (x / cabinHalf + 1) / 2, 0.075);
    const high = quadPoint(frontOuter, (x / cabinHalf + 1) / 2 + 0.13, 0.28);
    line(trim, [[low[0], low[1] + 0.004, low[2] + 0.005], [high[0], high[1] + 0.004, high[2] + 0.005]], 0.004);
    line(black, [[high[0] - 0.12, high[1] + 0.006, high[2] + 0.007], [high[0] + 0.12, high[1] + 0.006, high[2] + 0.007]], 0.005);
  }
  for (let i = -13; i <= 13; i++) box(black, [0.007, 0.002, truck ? 0.045 : 0.035], [i * 0.04, top(windFront) + 0.016, windFront + 0.028], 0);

  // Complete cabin: floor, inner door cards, pleated seats, dash, instruments and controls.
  const seatY = sports ? 0.46 : 0.56, seatZ = sports ? -0.51 : truck ? -0.10 : -0.17;
  box(black, [cabinHalf * 2 - 0.08, 0.045, windFront - windBack], [0, 0.35, (windBack + windFront) / 2]);
  for (const s of [-1, 1]) {
    box(upholstery, [0.035, belt - 0.39, 1.17], [s * (cabinHalf - 0.027), (belt + 0.39) / 2, truck ? 0 : -0.02], 0.01);
    box(black, [0.075, 0.047, 0.34], [s * (cabinHalf - 0.065), belt - 0.18, -0.05], 0.012);
    rod(chrome, [s * (cabinHalf - 0.06), belt - 0.24, 0.22], [s * (cabinHalf - 0.08), belt - 0.29, 0.27], 0.008);
    const x = s * 0.38;
    box(upholstery, [0.61, 0.14, 0.53], [x, seatY, seatZ], 0.048);
    box(upholstery, [0.61, sports ? 0.40 : 0.44, 0.13], [x, seatY + 0.23, seatZ - 0.23], 0.048, [-0.11, 0, 0]);
    for (let n = -3; n <= 3; n++) {
      line(black, [[x + n * 0.068, seatY + 0.074, seatZ + 0.18], [x + n * 0.068, seatY + 0.074, seatZ - 0.18]], 0.0018);
      line(black, [[x + n * 0.068, seatY + 0.06, seatZ - 0.155], [x + n * 0.068, seatY + 0.39, seatZ - 0.193]], 0.0018);
    }
    box(black, [0.045, 0.09, 0.08], [s * 0.08, seatY + 0.03, seatZ - 0.06]);
  }
  if (!truck && !sports) {
    box(upholstery, [1.29, 0.15, 0.39], [0, 0.59, -1.01], 0.04);
    box(upholstery, [1.29, 0.34, 0.12], [0, 0.78, -1.22], 0.04, [-0.2, 0, 0]);
  }
  const dashZ = windFront - 0.17, dashY = belt - 0.075;
  box(black, [cabinHalf * 2 - 0.06, 0.17, 0.30], [0, dashY, dashZ], 0.045);
  box(trim, [0.51, 0.14, 0.016], [0.37, dashY, dashZ - 0.156], 0.02);
  for (const [x, r] of [[0.25, 0.045], [0.38, 0.045], [0.49, 0.026]] as const) {
    disc(black, r, 0.008, [x, dashY, dashZ - 0.17]);
    ring(chrome, r, 0.003, [x, dashY, dashZ - 0.175]);
    line(lens, [[x, dashY, dashZ - 0.181], [x + r * 0.46, dashY + r * 0.44, dashZ - 0.181]], 0.0015);
  }
  box(trim, [0.18, 0.055, 0.012], [0, dashY - 0.01, dashZ - 0.163]);
  for (const x of [-0.08, 0.08]) disc(black, 0.012, 0.025, [x, dashY - 0.01, dashZ - 0.177], 'z', 12);
  const steering: V3 = [0.38, belt - 0.015, windFront - 0.46];
  rod(iron, [0.38, 0.55, windFront - 0.20], steering, 0.019);
  ring(black, 0.148, 0.011, steering);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 6;
    rod(trim, steering, [steering[0] + Math.cos(a) * 0.14, steering[1] + Math.sin(a) * 0.14, steering[2]], 0.006);
  }
  disc(black, 0.035, 0.022, steering);
  rod(iron, [0, 0.38, seatZ + 0.33], [0.02, 0.63, seatZ + 0.24], 0.009);
  g.add(new THREE.SphereGeometry(0.024, 12, 8), black, [0.02, 0.63, seatZ + 0.24]);
  box(black, [0.19, 0.05, 0.025], [0, roofY - 0.13, roofFront + 0.03], 0.01);

  // Front details are recessed into sealed valances rather than suspended ahead of them.
  const grilleY = truck ? 0.77 : sports ? 0.47 : 0.74;
  const grilleW = truck ? 0.96 : sports ? 0.90 : 1.00;
  box(black, [grilleW, truck ? 0.34 : sports ? 0.11 : 0.19, 0.035], [0, grilleY, end + 0.025], 0.012);
  for (let n = 0; n < (truck ? 5 : 6); n++) {
    const y = grilleY + (n - (truck ? 2 : 2.5)) * (truck ? 0.057 : sports ? 0.016 : 0.028);
    box(truck ? chrome : iron, [grilleW - 0.025, truck ? 0.018 : 0.008, 0.022], [0, y, end + 0.047], 0.003);
  }
  for (let n = -8; n <= 8; n++) box(iron, [0.006, truck ? 0.29 : sports ? 0.08 : 0.16, 0.012], [n * 0.05, grilleY, end + 0.041], 0);
  const headlight = (x: number, y: number, r: number, missing = false) => {
    disc(paint, r + 0.025, 0.12, [x, y, end - 0.02]);
    disc(black, r, 0.018, [x, y, end + 0.045]);
    ring(chrome, r + 0.003, 0.012, [x, y, end + 0.058]);
    if (!missing) {
      disc(lens, r * 0.91, 0.018, [x, y, end + 0.058]);
      for (let n = -4; n <= 4; n++) {
        const dx = n * r * 0.17, h = Math.sqrt((r * 0.89) ** 2 - dx * dx);
        line(trim, [[x + dx, y - h, end + 0.069], [x + dx, y + h, end + 0.069]], 0.0015);
      }
    } else disc(iron, 0.022, 0.014, [x, y, end + 0.056]);
    for (const a of [0, Math.PI]) disc(iron, 0.004, 0.006, [x + Math.cos(a) * r, y + Math.sin(a) * r, end + 0.073], 'z', 8);
  };
  for (const s of [-1, 1]) {
    if (truck) headlight(s * 0.69, 0.94, 0.127, kind === 1);
    else if (muscle) {
      for (const x of [0.60, 0.77]) headlight(s * x, 0.755, 0.073);
    } else if (sports) {
      // Flush pop-up covers conform to the hood, without the previous floating blocks.
      const q: V3[] = [[s * 0.36, 0, 1.70], [s * 0.70, 0, 1.70], [s * 0.70, 0, 2.01], [s * 0.36, 0, 2.01]];
      q.forEach(p => { p[1] = hoodY(p[0], p[2]) + 0.002; });
      line(black, [...q, q[0]], 0.002);
      box(lens, [0.22, 0.066, 0.02], [s * 0.66, 0.48, end + 0.03], 0.01);
    } else {
      box(chrome, [0.32, 0.185, 0.045], [s * 0.67, 0.75, end + 0.03], 0.02);
      box(black, [0.288, 0.153, 0.048], [s * 0.67, 0.75, end + 0.035], 0.015);
      box(lens, [0.27, 0.137, 0.05], [s * 0.67, 0.75, end + 0.04], 0.016);
      for (let n = -5; n <= 5; n++) line(trim, [[s * 0.67 + n * 0.022, 0.691, end + 0.066], [s * 0.67 + n * 0.022, 0.809, end + 0.066]], 0.0014);
    }
    const marker: V3 = truck ? [s * 0.945, 0.58, 1.58] : sidePoint(s, belt - 0.23, 1.94, 0.006);
    box(black, [0.011, 0.042, 0.11], marker, 0.004);
    box(amber, [0.014, 0.03, 0.095], [marker[0] + s * 0.004, marker[1], marker[2]], 0.004);
  }
  // Contoured bumpers wrap back onto their brackets and stop inside the collision envelope.
  for (const facing of [-1, 1]) {
    const bumperY = sports ? 0.35 : 0.43;
    const front = facing === 1;
    surface(sports || muscle ? paint : chrome, 48, 10, (u, v) => {
      const x = (u * 2 - 1) * 0.87;
      return [x, bumperY + (v - 0.5) * 0.11, facing * (2.235 - 0.14 * (Math.abs(x) / 0.87) ** 5 + 0.02 * Math.sin(v * Math.PI))];
    }, [0, 0, facing]);
    for (const s of [-1, 1]) {
      box(iron, [0.065, 0.075, 0.20], [s * 0.59, bumperY, facing * 2.13]);
      if (truck || kind === 0) box(chrome, [0.045, 0.18, 0.07], [s * 0.57, bumperY, facing * 2.235], 0.02);
    }
    if (!front) {
      const lampY = truck ? 0.66 : top(-end) - 0.14;
      for (const s of [-1, 1]) {
        if (sports) for (const x of [0.56, 0.73]) {
          disc(black, 0.067, 0.025, [s * x, lampY, -end - 0.026]);
          ring(chrome, 0.063, 0.004, [s * x, lampY, -end - 0.041]);
          disc(red, 0.055, 0.028, [s * x, lampY, -end - 0.04]);
        } else {
          box(chrome, [truck ? 0.13 : 0.29, 0.15, 0.035], [s * 0.68, lampY, -end - 0.025], 0.014);
          box(red, [truck ? 0.103 : 0.26, 0.12, 0.039], [s * 0.68, lampY, -end - 0.035], 0.01);
          for (let n = -3; n <= 3; n++) box(trim, [truck ? 0.09 : 0.24, 0.0015, 0.002], [s * 0.68, lampY + n * 0.013, -end - 0.056], 0);
        }
      }
      box(chrome, [0.31, 0.13, 0.017], [0, 0.55, -end - 0.026]);
      box(black, [0.28, 0.105, 0.019], [0, 0.55, -end - 0.033]);
      for (let n = -3; n <= 3; n++) box(lens, [0.013, 0.038, 0.002], [n * 0.027, 0.55, -end - 0.045], 0);
    }
  }
  if (muscle) {
    // A low stamped scoop with an open dark mouth, blended down at its rear.
    surface(paint, 16, 16, (u, v) => {
      const x = (u * 2 - 1) * 0.26, z = lerp(1.08, 1.59, v);
      return [x, hoodY(x, z) + 0.065 * Math.sin(u * Math.PI) * v, z];
    }, [0, 1, 0]);
    box(black, [0.38, 0.035, 0.016], [0, hoodY(0, 1.59) + 0.026, 1.59]);
  }
  rod(iron, [-0.51, 0.23, -1.1], [-0.58, 0.23, -2.13], 0.033);
  ring(chrome, 0.035, 0.004, [-0.58, 0.23, -2.14]);

  // Recessed rim barrels, brake rotors, shaped spokes/steel dishes and five actual lug nuts.
  for (const s of [-1, 1]) for (const z of axles) {
    const wheelX = 0.83, bare = kind === 1 && z > 0;
    if (!bare) {
      const tire = createYardTire(tireR, muscle || sports ? 0.245 : 0.215);
      tire.rotation.z = Math.PI / 2; tire.position.set(s * wheelX, wheelY, z); tire.name = 'Treaded tire'; root.add(tire);
    }
    const r = bare ? 0.18 : tireR * 0.59;
    disc(iron, r * 0.84, 0.036, [s * 0.87, wheelY, z], 'x');
    if (!bare) {
      const profile = [[r * 0.91, -0.095], [r, -0.095], [r * 1.03, -0.08], [r, -0.063], [r * 0.91, -0.05], [r * 0.91, 0.07], [r, 0.083], [r * 1.03, 0.10], [r * 0.95, 0.11]];
      g.add(new THREE.LatheGeometry(profile.map(([a, b]) => new THREE.Vector2(a, b)), 56), chrome, [s * wheelX, wheelY, z], [0, 0, -s * Math.PI / 2]);
      if (muscle || sports) {
        for (let n = 0; n < (muscle ? 5 : 8); n++) {
          const a = n * Math.PI * 2 / (muscle ? 5 : 8);
          const point = (rad: number, angle: number, x: number): V3 => [s * x, wheelY + Math.cos(angle) * rad, z + Math.sin(angle) * rad];
          const q = [point(r * 0.25, a - 0.12, 0.948), point(r * 0.91, a - 0.055, 0.936), point(r * 0.91, a + 0.12, 0.936), point(r * 0.25, a + 0.23, 0.948)];
          patch(muscle ? trim : chrome, q, [s, 0, 0]);
          patch(iron, [q[1], q[2], point(r * 0.91, a + 0.12, 0.921), point(r * 0.91, a - 0.055, 0.921)], [0, 1, 0]);
        }
        box(red, [0.035, 0.13, 0.05], [s * 0.90, wheelY + 0.015, z + r * 0.65]);
      } else {
        disc(iron, r * 0.87, 0.035, [s * 0.92, wheelY, z], 'x');
        for (let n = 0; n < 8; n++) {
          const a = n * Math.PI / 4;
          disc(black, 0.023, 0.003, [s * 0.94, wheelY + Math.cos(a) * r * 0.68, z + Math.sin(a) * r * 0.68], 'x', 16);
        }
        disc(chrome, r * 0.40, 0.035, [s * 0.95, wheelY, z], 'x');
      }
    } else ring(iron, r * 0.90, 0.013, [s * 0.90, wheelY, z], 'x');
    disc(trim, r * 0.26, 0.025, [s * 0.963, wheelY, z], 'x');
    for (let n = 0; n < 5; n++) {
      const a = n * Math.PI * 2 / 5;
      disc(chrome, 0.010, 0.015, [s * 0.969, wheelY + Math.cos(a) * r * 0.40, z + Math.sin(a) * r * 0.40], 'x', 6);
    }
    if (!bare) rod(black, [s * 0.94, wheelY + r * 0.89, z], [s * 0.962, wheelY + r * 0.89, z], 0.005);
  }
  if (kind === 0) {
    for (const s of [-1, 1]) line(trim, [[s * 0.53, roofY + 0.11, -0.60], [s * 0.53, roofY + 0.11, 0.32]], 0.012);
    for (const z of [-0.55, 0.26]) {
      line(chrome, [[-0.60, roofY + 0.11, z], [0.60, roofY + 0.11, z]], 0.012);
      for (const s of [-1, 1]) rod(black, [s * 0.57, roofY + 0.01, z], [s * 0.57, roofY + 0.11, z], 0.010);
    }
  }
  g.finish(root);
  if (kind === 1) {
    const settled = new THREE.Group(); settled.name = 'Resting chassis';
    for (const child of [...root.children]) settled.add(child);
    settled.rotation.x = 0.045; settled.position.y = -0.060; root.add(settled);
  }
  return root;
}

