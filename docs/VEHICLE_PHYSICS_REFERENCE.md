# Realistic Vehicle & World Physics Reference

A practical field guide to simulating ground vehicles that feel real: world forces, suspension, tires, drivetrain, aerodynamics, weight transfer, rollover, damage, and the numerical tricks that keep it all stable.

All units SI unless noted: meters, kilograms, seconds, newtons, radians.

---

## 1. The World

### 1.1 Constants
| Quantity | Value |
|---|---|
| Gravity `g` | 9.81 m/s² |
| Air density `ρ` (sea level, 15 °C) | 1.225 kg/m³ |
| Air density at 2000 m | ~1.007 kg/m³ |
| Speed of sound | 343 m/s |
| 1 m/s | 3.6 km/h = 2.237 mph |

Air density falls ~12% per 1000 m of altitude: `ρ = 1.225 · exp(-h / 8500)`.

### 1.2 Fixed timestep
- Simulate at a **fixed** step (120 Hz is a good floor for vehicles; 240 Hz+ for stiff suspension). Render interpolates.
- Variable timesteps make springs, tires, and collision behave differently at different frame rates. Never integrate vehicle forces with raw frame `dt`.
- Use **semi-implicit (symplectic) Euler**: update velocity from forces first, then position from the *new* velocity. It is stable for oscillators where explicit Euler gains energy and explodes.
- Sub-step stiff systems (tires, suspension) inside the main step rather than shrinking the whole world step.
- Clamp the accumulator (e.g. max 5 steps per frame) to avoid the spiral of death.

### 1.3 Rigid body essentials
- State: position, orientation (quaternion), linear velocity, angular velocity.
- `F = m·a`, `τ = I·α + ω × (I·ω)`.
- Inertia tensor of a box (mass `m`, dimensions `w` wide, `h` tall, `l` long):
  - `Ixx = m/12 · (h² + l²)` (pitch)
  - `Iyy = m/12 · (w² + l²)` (yaw)
  - `Izz = m/12 · (w² + h²)` (roll)
- **Real vehicles are not boxes.** Mass is concentrated at the axles, engine, and cargo; a solid box under-estimates yaw inertia. Scale yaw inertia up by ~1.2–1.5× for a sedan, more for loaded trucks. Too low an inertia makes the car twitchy and spin-prone; too high feels like a barge.
- Renormalize the quaternion every step.
- Apply forces at **world-space contact points** (`τ = r × F`), not at the center of mass, or nothing will pitch/roll correctly.

### 1.4 Center of mass
- The single most important number for handling and rollover.
- Passenger car: ~0.5 m above ground. SUV: ~0.7 m. Pickup loaded high: 0.8–1.0 m. Box truck loaded: 1.2–1.8 m. Semi: 1.5–2.2 m.
- Low CoM = stable, planted, resists rollover. High CoM = tippy, big weight transfer.
- Longitudinal position sets weight distribution: front-engine cars sit ~55–60% front; mid-engine ~40/60; trucks shift rearward when loaded.
- **Moving cargo/passengers must update CoM and inertia at runtime.** A loaded roof rack or pickup bed changes handling dramatically.

---

## 2. Suspension

### 2.1 Spring–damper model
Each wheel is a spring and damper between chassis and wheel hub:

```
F_spring = k · compression
F_damper = c · compression_velocity          (use different c for bump vs rebound)
F_total  = max(0, F_spring + F_damper)       (suspension can only push, never pull the ground)
```

- `compression = restLength − currentLength`, clamped to `[0, travel]`.
- Raycast (or shapecast) down from the mount point to find the ground; `currentLength = hitDistance − wheelRadius`.
- Apply `F_total` along the **suspension axis** (usually chassis up), at the contact/mount point.

### 2.2 Choosing spring rate
Natural frequency of a corner:

```
f = (1 / 2π) · sqrt(k / m_corner)         (m_corner = sprung mass at that wheel)
```

| Vehicle type | Target ride frequency |
|---|---|
| Soft luxury / off-road truck | 1.0 – 1.4 Hz |
| Normal passenger car | 1.2 – 1.8 Hz |
| Sport car | 1.8 – 2.5 Hz |
| Race car (with aero) | 3 – 6 Hz |

Solve `k = m_corner · (2π f)²`. Example: 400 kg corner at 1.5 Hz → `k ≈ 35,500 N/m`.

- Front/rear frequencies: keep the **rear slightly higher** (~10–20%) so the rear "catches up" after a bump and the car pitches flat instead of bobbing.
- Heavy trucks/vans: spring rate must scale with the **loaded** mass, or the empty vehicle rides rock-hard and the loaded one bottoms out. Use progressive rates or variable `m_corner`.

### 2.3 Damping
Damping ratio `ζ = c / (2·sqrt(k·m))`.

- `ζ ≈ 0.25–0.4` is typical for road cars (some bounce, then settles).
- `ζ = 1.0` is critically damped (no overshoot, feels dead/numb).
- `ζ < 0.15` pogo-sticks forever.
- **Rebound damping > bump damping** (roughly 2:1 up to 3:1). Compression should be softer so wheels absorb sharp bumps; rebound firmer so the body doesn't oscillate.
- Add a **high-speed knee**: damping coefficient drops at high shaft velocity (blow-off valve) so sharp curb hits don't spike force.

### 2.4 Travel, bump stops, and droop
- Total travel: passenger car 0.15–0.2 m, SUV 0.2–0.3 m, off-road truck 0.3–0.5 m.
- **Bump stop**: a very stiff, progressive spring over the last 10–20% of compression. Hitting travel limit with a hard clamp creates infinite force and launches the car; use a rapidly rising spring instead.
- **Droop limit**: when fully extended the wheel stops; beyond that the wheel simply hangs (and lifts the chassis if overextended in a rollover).
- **Preload / ride height**: static compression under weight = `m_corner·g / k`. Pick rest length so the loaded car sits at mid-travel, not at a stop.

### 2.5 Anti-roll bars (sway bars)
Couples left/right wheels on an axle to resist body roll:

```
F_arb = k_arb · (compression_L − compression_R)
apply  +F_arb to the more-compressed side's chassis mount... and  −F_arb to the other (equal and opposite, vertical)
```

- Stiffer **front** bar → understeer. Stiffer **rear** bar → oversteer. This is the main tuning knob for balance without changing grip.
- Trucks and SUVs need stiffer bars to compensate for their tall CoM.
- A bar also transmits one wheel's bump to the other side, which is why a one-wheel bump twitches a car.

### 2.6 Suspension geometry effects (cheap approximations)
- **Camber gain**: wheel leans into the corner as the body rolls; adds lateral grip. Approximate by increasing tire lateral peak with a small bonus proportional to roll angle (negative camber helps the outside tire).
- **Toe**: slight toe-in = straight-line stability, slight toe-out = quicker turn-in. Model as a small steering offset per wheel.
- **Roll centers / anti-dive / anti-squat**: how much braking/accel force goes through links rather than compressing springs. A simple version: apply a fraction (`0–0.5`) of the longitudinal tire force at the chassis at a height equal to the pivot point instead of at the ground, reducing pitch.
- **Solid axle** (trucks): both wheels share one rigid beam; a bump on one side tilts the whole axle. Needs an axle body constraint, not independent raycasts. Gives tremendous articulation and loaded capacity, but rougher ride and more interdependence.
- **Independent**: each wheel moves on its own. Smoother, better grip on uneven ground.

### 2.7 Articulation & off-road
- Wheel lift happens when one corner droops past its limit. With an open differential that wheel then spins free and the car stalls (see §4.4).
- Long-travel + soft springs keep tires on bumpy ground and keep traction.
- Axle flex and approach/departure/breakover angles determine what terrain the vehicle can clear: `breakover = atan(2·clearance / wheelbase)` roughly.

---

## 3. Tires — the heart of vehicle feel

Everything the vehicle does to the world goes through four contact patches the size of your hand. Get the tire right and the rest follows.

### 3.1 Friction circle
A tire has a finite grip budget `μ·N` (friction coefficient × normal load). Longitudinal and lateral forces share it:

```
sqrt(Fx² + Fy²) ≤ μ · N
```

- Braking hard in a corner reduces cornering grip. Flooring it mid-turn causes understeer or oversteer.
- Implementation: compute desired `Fx` and `Fy`, then if their magnitude exceeds `μN`, scale both down proportionally (or use an ellipse if longitudinal and lateral peaks differ).

### 3.2 Friction coefficients (peak, dry unless noted)
| Surface | μ |
|---|---|
| Racing slick, dry asphalt | 1.4 – 1.8 |
| Road tire, dry asphalt | 0.9 – 1.1 |
| Road tire, wet asphalt | 0.5 – 0.7 |
| Dry packed dirt / gravel | 0.5 – 0.7 |
| Loose gravel / sand | 0.3 – 0.5 |
| Mud | 0.2 – 0.4 |
| Wet grass | 0.2 – 0.35 |
| Packed snow | 0.2 – 0.3 |
| Ice | 0.05 – 0.15 |
| Off-road (knobby) on dirt | 0.7 – 0.9 |

Sliding (kinetic) friction is **lower** than peak, typically 70–90% of peak. That drop is why a locked or spinning tire stops worse than one at the edge of grip.

### 3.3 Slip
Tires don't roll freely; they deform and "slip" slightly to produce force.

- **Slip ratio** (longitudinal): `κ = (ωR − v_x) / max(|v_x|, ε)` where `ω` is wheel angular speed, `R` the effective radius, `v_x` ground speed along the wheel heading. `κ = 0` free roll; `κ = −1` locked while moving; `κ → ∞` spinning on the spot.
- **Slip angle** (lateral): `α = atan2(v_y, |v_x|)`: the angle between where the tire points and where it is actually moving.
- Peak longitudinal force at `|κ| ≈ 0.08–0.15`. Peak lateral force at `|α| ≈ 4°–10°` (road) or 8°–15° (off-road/soft tires). Beyond the peak, force *falls* — the cliff you slide off of.

### 3.4 Force curves
Use a **Pacejka "Magic Formula"** shape or a cheap approximation:

```
F = D · sin( C · atan( B·x − E·(B·x − atan(B·x)) ) )
```

- `D` = peak force (`μ·N`), `C` shape (~1.3–1.9), `B` stiffness, `E` curvature.
- Simplified alternative: linear up to a peak, then smooth falloff to the sliding value. Always smooth the transition; hard corners cause jitter.
- At **low speed** slip angle and ratio blow up (division by tiny `v_x`). Blend to a viscous/spring friction model below ~1–3 m/s so the car can actually stop and rest on a hill without creeping or vibrating.

### 3.5 Load sensitivity
Tire grip is **not** linear with load: doubling normal force gives less than double grip (μ falls as load rises). Consequences:
- Weight transfer (§5) always costs total grip; the loaded outside tire gains less than the unloaded inside tire loses.
- Wider tires and more tires help; a heavy truck needs duals or wide singles.
- Model: `μ_eff = μ0 · (1 − k_load · (N / N_rated − 1))`, clamp to sane bounds.

### 3.6 Self-aligning torque & steering feel
- Lateral force acts behind the contact-patch center ("pneumatic trail"), creating a torque that tries to straighten the wheel.
- That torque rises with slip angle, peaks, then **drops near the limit** — the steering gets light just before grip is lost. Feed it to force feedback or the steering return.
- Static steering return: also add caster-based centering proportional to speed.

### 3.7 Tire radius, pressure, and rolling resistance
- Effective rolling radius shrinks slightly with load and grows slightly with speed (centrifugal growth).
- **Rolling resistance**: `F_rr = C_rr · N`. Road tire on asphalt `C_rr ≈ 0.01–0.015`; truck tire 0.006–0.01; loose gravel ~0.04; sand 0.2–0.4; soft mud higher still. This is the dominant resistance below ~50 km/h.
- **Pressure**: low pressure widens the contact patch (more grip on soft ground, better floatation) but raises rolling resistance and sidewall flex. Airing down for sand/rock is real.
- Tire temperature affects grip (sweet spot ~80–100 °C for performance tires). Optional: heat up under slip, cool with airflow; grip bell-curved around the optimum.

### 3.8 Soft ground
- Terrain deforms; sinkage increases rolling resistance and reduces forward thrust.
- Model as `μ` and `C_rr` depending on a ground-type map, with extra drag proportional to sinkage depth for mud/sand, and a "bogging" loss when wheel spin exceeds traction (wheels dig in).
- Wheel spin in loose material *reduces* the available grip further (digging, losing the surface layer).

---

## 4. Drivetrain

### 4.1 Engine
- Torque curve: lookup table of torque vs. RPM. Gas engines peak mid-range and fall off near redline; diesels peak low and die early; electric motors give **flat max torque from 0 rpm** then taper (constant power) above base speed.
- Power: `P = τ · ω` (ω in rad/s); `hp = τ(Nm) · rpm / 7121`.
- **Engine braking**: closed throttle applies negative torque proportional to RPM (pumping/friction losses).
- Include **rotational inertia** of the engine/flywheel; it makes RPM climb and fall realistically and smooths shifts.
- Idle controller prevents stalls; stalling happens when RPM drops below ~500 under load without clutch slip.

Typical figures:
| Engine | Peak torque | Peak power | Redline |
|---|---|---|---|
| Compact gas | 150–200 Nm | 90–130 hp | 6500 |
| Large V8 truck | 500–700 Nm | 300–450 hp | 5500–6000 |
| Heavy diesel | 800–1500+ Nm | 250–450 hp | 2500–3200 |
| Passenger EV | 300–700 Nm | 200–500 hp | 16,000+ |

### 4.2 Gearbox
- Wheel torque = `engine_torque · gear_ratio · final_drive · efficiency (~0.85–0.95)`.
- Typical ratios (5-speed): 3.6 / 2.0 / 1.4 / 1.0 / 0.8, final drive 3.4–4.1.
- Trucks: lower first gear (4–7:1) and a low-range transfer case (2–3:1) for crawling and towing.
- Shift: cut torque during a short shift time (150–400 ms manual, 50–200 ms automatic/DCT) so the car doesn't instantly jump.
- Automatic logic: upshift near peak-power RPM at full throttle, earlier when cruising; add hysteresis and a kickdown. Prevent hunting.
- Wheel speed ↔ engine speed: `rpm = wheelRPM · gear_ratio · final_drive`, passed through the clutch.

### 4.3 Clutch / torque converter
- Clutch transmits torque up to a max capacity `T_max`; slip beyond that. Model as a friction clutch: `T = clamp(k·Δω, −T_max, T_max)`.
- Torque converter (automatic): torque multiplication (up to ~2×) at stall, fluid coupling that locks up at cruise. Explains why autos creep at idle.

### 4.4 Differentials
Open differential: **equal torque** to both wheels. A wheel with no grip (in the air or on ice) limits torque to what it can transmit (almost none) — the car goes nowhere. The wheel with *less* grip decides.

- **Limited-slip (LSD)**: transmits extra torque to the slower wheel via preload and ramp friction. Helps traction when one wheel is light.
- **Locked / spool**: both wheels spin at the same speed. Best traction in mud/rock, but fights during turns on high-grip surfaces (axle windup, tire scrub, understeer).
- **Torque-vectoring / electronic**: brake the spinning wheel to shift torque.
- Center diff (AWD/4WD): splits torque front/rear. A locked center diff (4WD) gives maximum low-grip traction; on pavement it binds in turns.
- Drive type changes handling character:
  - **FWD**: understeer under power, lift-off oversteer, safe/predictable.
  - **RWD**: power oversteer, balanced weight, drift-capable; trucks go light in the rear when empty.
  - **AWD/4WD**: strongest traction, better stability; heavier.

### 4.5 Braking
- Brake torque applied per wheel: `T_brake = pedal · max_torque · bias`.
- Front bias ~60–70% (weight transfers forward under braking; more rear brake = lockup and spins).
- Max decel on dry asphalt ≈ `μ · g` ≈ 0.9–1.0 g for road tires; slicks > 1.5 g; wet 0.5 g; ice 0.1 g.
- Brake fade: sustained heat reduces friction. Model heat accumulation (energy absorbed minus cooling) and scale torque by a fade curve.
- **ABS**: release brake torque when slip ratio exceeds the peak (≈ −0.15 to −0.2), reapply when it recovers; pulsing at 10–15 Hz. Without ABS locked wheels lose steering and stop longer on hard surfaces (but plow *shorter* in loose gravel/snow).
- Handbrake: locks the rear wheels only — the standard tool for initiating a slide.
- Parking brake/hill hold: static friction on slopes needs a stiction model to prevent creep.

---

## 5. Weight transfer & load dynamics

### 5.1 Longitudinal
```
ΔN = m · a · h / L        (h = CoM height, L = wheelbase)
```
- Acceleration shifts load rearward (rear tires grip more, front lighter, push to understeer).
- Braking shifts load forward (front tires grab, rear goes light, rear may lock).
- This is why high CoM + short wheelbase brakes/pitches dramatically.

### 5.2 Lateral
```
ΔN_axle = m_axle · a_lat · h / t        (t = track width)
```
- Cornering shifts load to the outside tires. With load sensitivity (§3.5) this reduces total axle grip. The axle that transfers *more* load loses more grip and slides first. This is how bar stiffness tunes understeer/oversteer.
- **Rollover threshold** ≈ `a_lat = g · (t / 2) / h`:
  - Sedan: t = 1.5, h = 0.5 → ~1.5 g (will slide before tipping)
  - SUV: t = 1.6, h = 0.7 → ~1.15 g
  - Loaded pickup/box truck: t = 1.8, h = 1.4 → ~0.64 g (will tip in a hard swerve)
  - Semi: t = 2.0, h = 1.8 → ~0.55 g

### 5.3 Pitch, roll, and heave
- Body pitches nose-down under braking, nose-up under acceleration; rolls outward in turns. These come naturally from spring forces if the suspension is physical.
- Add a small amount of body inertia coupling so the car doesn't snap instantly to the weight-transfer equilibrium; the springs/dampers set the transient.
- Transient behavior matters: a fast steering input first loads the front axle, producing a brief understeer bite, then the rear follows.

---

## 6. Steering & cornering

### 6.1 Ackermann
Inside wheel must turn tighter than the outside. With wheelbase `L`, track `t`, turn radius `R`:

```
δ_inside  = atan(L / (R − t/2))
δ_outside = atan(L / (R + t/2))
```
Pure Ackermann at low speed; at high speed with large slip angles, parallel steer (or even anti-Ackermann) is closer to correct. Blend by speed.

### 6.2 Steering limits and speed sensitivity
- Max wheel angle: ~30–40° passenger car, ~25–35° trucks.
- Reduce steering authority with speed: `δ_max(v) = δ_max / (1 + (v / v_ref)²)` with `v_ref` ≈ 15–25 m/s. Real cars do this mechanically (you only need a few degrees at 100 km/h).
- Smooth the input with rate limits (steering takes time): ~2–4 rad/s max wheel rate, with centering faster than turning-in.

### 6.3 Understeer, oversteer, and the bicycle model
Linear handling: `understeer gradient K = (W_f/C_αf − W_r/C_αr) / g`.
- `K > 0` understeer (front slides first, safe).
- `K < 0` oversteer (rear slides first, spin).
- Adjust via: weight distribution, tire widths/pressures, spring/bar stiffness, aero balance, differential, and tire load sensitivity.

### 6.4 Turn radius / speed limit
```
v_max = sqrt(μ · g · R)           (flat, no aero)
```
Banking helps: `v_max² = g R (sinθ + μ cosθ)/(cosθ − μ sinθ)`.

### 6.5 Drifting
- Rear slip angle past peak, then counter-steer to hold the angle. Needs: RWD, enough power to maintain wheelspin, rear tires that lose grip progressively (not a cliff).
- Make post-peak force falloff gentle to keep drifts controllable; a sharp cliff makes every slide a spin.
- Counter-steer is automatic if the steering returns toward the velocity direction (self-aligning torque).

---

## 7. Aerodynamics

### 7.1 Drag
```
F_drag = ½ · ρ · Cd · A · v²
P_drag = F_drag · v              (power rises with v³)
```
| Vehicle | Cd | Frontal area A (m²) |
|---|---|---|
| Streamlined EV | 0.20 – 0.25 | 2.2 |
| Sedan | 0.28 – 0.32 | 2.2 |
| SUV | 0.33 – 0.40 | 2.7 |
| Pickup (bed open) | 0.40 – 0.50 | 3.0 |
| Box truck | 0.60 – 0.80 | 6 – 8 |
| Semi-trailer | 0.55 – 0.70 | 9 – 10 |
| Open-wheel race car | 0.7 – 1.0 | 1.0 |

- Drag opposes velocity **relative to the air** (include wind): `v_rel = v_vehicle − v_wind`.
- Top speed is reached when `drive force = drag + rolling resistance + grade`.
- Slipstreaming: a vehicle in another's wake sees reduced `Cd` (up to 30–40% reduction at 1 car-length).

### 7.2 Lift and downforce
```
F_lift = ½ · ρ · Cl · A · v²       (negative Cl = downforce)
```
- Most road cars generate slight lift (Cl ≈ +0.1–0.3); sports cars and race cars use wings and underbodies for downforce (Cl −1 to −4).
- Downforce raises grip with speed² and doesn't add inertia; it improves high-speed cornering but not low-speed.
- Apply at the **center of pressure**, not the CoM. A CoP behind the CoM adds stability; ahead of it, instability.

### 7.3 Crosswind and yaw
- Side force `F_y = ½ ρ Cy A_side v_cross²` applied at the side-profile center (above the CoM for tall boxes), producing both sideslip and roll moment.
- High-sided vehicles (vans, box trucks, trailers) are strongly affected; this is how gusts push trucks across lanes or tip empty trailers.
- Yaw stability: aerodynamic yaw moment tends to align the vehicle with the airflow (weathervane), stronger for tall tails.

### 7.4 Ground effect & rain
- Ground effect increases downforce closer to the ground; a simple approach is scaling `Cl` with ride height.
- Rain: reduce `μ` and add hydroplaning above ~70–90 km/h on deep water (tire tread depth and pressure matter): a progressive loss of grip as speed increases.

---

## 8. Terrain, slopes & surfaces

### 8.1 Gravity on slopes
```
F_slope = m · g · sin(θ)           (along slope)
N       = m · g · cos(θ)           (against the surface)
```
- Maximum climbable grade ≈ `tan(θ) = μ` for a traction-limited vehicle.
- A 10% grade ≈ 5.7°; 30% ≈ 16.7°; 100% = 45°.
- Parked vehicle on a slope stays put only if `μ_static ≥ tan(θ)`; brakes are what really hold it.

### 8.2 Terrain contact
- Raycast per wheel gives contact point, normal, and surface material. Use the **ground normal** (not the chassis up) to compute the tangent frame for tire forces.
- Smooth terrain normals at triangle boundaries or the car jolts on every mesh edge.
- For heightfield/tiled terrain, interpolate heights and normals bilinearly; for chunk boundaries, share edge samples.
- Use the average of the 3–5 samples across the wheel width/length to filter high-frequency noise ("tire envelope" approximation) instead of a single point ray; real tires bridge small pits.

### 8.3 Speed bumps, potholes, washboard
- Bump frequency vs. suspension frequency: driving over washboard at the resonant speed makes the car shake; going faster or slower smooths it. This falls out naturally from a good spring/damper model.
- Potholes: short loss of wheel contact, spike of rebound, then a bump-stop hit on exit.

### 8.4 Water & fording
- Buoyancy: `F_b = ρ_water · g · V_submerged` (ρ_water = 1000 kg/m³). Sedans float briefly at ~1 m depth; they lose engine intake (stall) much earlier at ~0.5 m.
- Drag in water is ~800× higher than in air; apply strongly with speed² and wheel depth.
- Grip drops sharply when wheels are floating.

### 8.5 Jumps and landings
- Ballistic flight: `x(t)`, `y(t)` under gravity with air drag; angular momentum stays constant unless aerodynamic moments act.
- Pitch in the air: throttle/brake cause a gyroscopic and torque reaction (wheel spin-up → nose pitch); real effect, small, and fun to include.
- Landing: suspension must absorb `v²/(2·travel)`. Landing on 4 wheels at 6 m/s fall speed over 0.25 m of travel ≈ 7 g decel; beyond travel the bump stops/chassis take the hit (damage, §10).

---

## 9. Rollover, flips, and recovery

### 9.1 Why vehicles roll
- Static: lateral acceleration `a_lat > g·t/(2h)` (see §5.2).
- Dynamic: sudden steering input, curb or soft shoulder "trip" (a lateral force at wheel height creates a large overturning moment), slope traversing.
- Tripping: if the tires dig in or hit an obstacle while sliding sideways, the side force is at ground level and generates `M = F·h` about the CoM; this is the most common real-world rollover cause.

### 9.2 Slope angles
Sideslope static stability: `θ_max = atan(t / (2h))`.
- Sedan ~56°, SUV ~49°, loaded pickup ~33°, loaded box truck ~28°.

### 9.3 Roll dynamics
- Use the real rigid-body inertia; once a vehicle is past ~tipping angle it keeps rotating.
- Once rolling, replace tire forces with body collision against the ground; use a convex hull or several boxes for the chassis (not just one cube), with roof crush.
- Add angular damping while airborne/rolling (air drag and ground friction) to settle the final position.

### 9.4 Recovery
- A vehicle on its side/roof can't be driven; only the tires' ground contact generates drive forces.
- Self-righting requires a deliberate rotation impulse, a winch, or players pushing; real vehicles can't flip themselves. If you provide a self-right, apply a smooth torque and lift instead of teleporting.
- Stuck/bogged state: detect `speed < threshold` while `throttle > 0` and wheels spinning; offer freeing mechanics (rocking, traction mats, winching, airing down).

---

## 10. Damage & wear

### 10.1 Collisions
- Impulse-based response: relative velocity along the contact normal, restitution 0.0–0.2 (cars are nearly inelastic), friction applied tangentially.
- Impact energy `E = ½ m v²_closing`. Crash severity metrics: Δv and peak deceleration. Humans: >20 g is life-threatening; unrestrained injuries start at Δv ≈ 20 km/h.
- Crumple zones absorb energy in structure; mass ratio decides the winner (the lighter vehicle takes a larger Δv: `Δv₁ = m₂/(m₁+m₂) · (1+e)·v_rel`).
- Deform visually via vertex displacement near the impact point, scaled by impulse and capped; also store permanent mesh deformation and reduced stiffness locally.

### 10.2 Component damage
Map impacts and wear to subsystems:
| Subsystem | Effect when damaged |
|---|---|
| Engine | Torque loss (up to 50–70%), stalling, smoke |
| Radiator/cooling | Overheating → power loss → seizure |
| Transmission | Missed shifts, slipping, stuck gears |
| Suspension arm/strut | Ride height droops on that corner; camber change; pulls to one side |
| Steering | Reduced angle, wander, pull |
| Tires | Flat → massive `C_rr`, lateral grip loss, wheel pulling to that side; blowout → sudden pull |
| Brakes | Longer stopping distance, fade, one-sided pull |
| Axle | Wheel disconnection, lost drive |
| Fuel/oil | Leaks (rate-based), fire risk |
| Frame | Alignment shift, reduced structural stiffness |

### 10.3 Wear & failure
- Tires wear with accumulated slip energy; worn tires have less tread → lower wet grip, lower puncture resistance.
- Brake pad wear, shock fade (heat), oil/coolant/fuel consumption, battery.
- Overloading: exceeding the rated axle load raises failure probability (bearings, springs, tires). Bounded to rated GVWR physics: exceeding it degrades braking (more kinetic energy), handling (higher CoM), and wear rate.

### 10.4 Fire & fluids
- Fuel leak plus heat source (exhaust, sparks, hot engine) → ignite probability; fire spreads based on remaining fuel and ventilation.
- Overheating: coolant temperature rises with load and slow airflow; thresholds cause derating, then shutdown, then permanent damage.

---

## 11. Loads, cargo & trailers

### 11.1 Payload
- Add mass at specific positions; recompute total mass, CoM, and inertia tensor with the parallel axis theorem: `I = I_cm + m·d²`.
- A high or rear-biased load produces handling shifts (rear squat, light front, higher rollover risk).
- Unsecured cargo shifts under braking/cornering (sliding if `a > μ_cargo · g`) and moves the CoM mid-maneuver. Great source of realistic drama.

### 11.2 Towing
- The hitch is a ball joint: transmits force but not torque (about the vertical and lateral axes it pivots).
- Tongue weight should be 10–15% of trailer weight; too little → trailer sway, too much → rear squat and steering lightness.
- **Trailer sway**: unstable oscillation about the hitch that grows with speed; avoid by correct tongue weight, trailer axle placement, and brakes. Model with a yaw-articulation joint and a damped lateral dynamics at the trailer axle.
- **Jackknife**: when the trailer pushes the tow vehicle (braking on a slippery surface, rear tires locked), the articulation angle grows beyond recovery.
- Trailer brakes (electric/surge) reduce jackknife risk; without them, stopping distance scales with total mass.
- Reverse steering is unstable (the trailer turns opposite to the steering input) — real and challenging.
- Total mass hitting a tow vehicle's rating overloads brakes, cooling, and the drivetrain.

### 11.3 Passengers & fuel
- Fuel mass: gasoline ≈ 0.74 kg/L, diesel ≈ 0.83 kg/L. A 100 L tank of diesel is 83 kg — small relative to the vehicle but noticeable in slosh dynamics for tanker trailers.
- Liquid slosh: lateral acceleration moves the CoM of partially filled tanks, amplifying lateral weight transfer ("free surface effect").

---

## 12. Speed, energy & stopping reference

| Speed (km/h) | m/s | Stopping distance at 0.8 g (no reaction) | Kinetic energy for 1500 kg |
|---|---|---|---|
| 30 | 8.3 | 4.4 m | 52 kJ |
| 50 | 13.9 | 12.3 m | 145 kJ |
| 80 | 22.2 | 31.4 m | 370 kJ |
| 100 | 27.8 | 49.2 m | 580 kJ |
| 130 | 36.1 | 83 m | 980 kJ |
| 160 | 44.4 | 126 m | 1480 kJ |

- Stopping distance: `d = v² / (2·μ·g)`; add reaction distance `v · t_reaction` (≈ 1 s for attentive drivers).
- Energy scales with v²: doubling speed quadruples crash energy and stopping distance.

### Acceleration sanity checks
| Vehicle | 0–100 km/h |
|---|---|
| Economy car | 10 – 13 s |
| Family sedan | 7 – 9 s |
| Sports car | 3.5 – 5 s |
| Heavy pickup | 6 – 9 s |
| Loaded box truck | 15 – 25 s |
| Loaded semi | 30 – 60 s |

Traction-limited peak acceleration: `a = μ · g · (driven axle load fraction)`.

---

## 13. Realism pitfalls (and fixes)

| Symptom | Likely cause | Fix |
|---|---|---|
| Car bounces forever | Damping too low or integrator unstable | Raise `ζ` to ~0.3; use semi-implicit Euler; smaller fixed step |
| Car explodes on spawn/landing | Penetration resolved in one step; bump stop is a hard wall | Progressive bump stop; clamp suspension velocity; spawn with initial spring compression |
| Car jitters at rest | Slip ratio/angle division by tiny speed | Blend to viscous friction under ~2 m/s; sleep when still |
| Slides downhill when parked | No static friction | Add a stiction clamp: if speed < ε and no throttle, cancel tangential force up to `μ_s·N` |
| Feels like it's on rails | Tire force has no falloff past peak, or no load sensitivity | Add post-peak decline and load sensitivity |
| Constant understeer | Front grip budget exhausted / too much front bias | Reduce front stiffness/bar, shift weight rearward, widen front tires |
| Spins out in every corner | Cliff-like tire falloff or rear too light | Soften falloff, increase rear grip or damping |
| Flips on small curbs | Single-point side collision at wheel height | Chamfer/round curb colliders; give the chassis a low CoM; add roll damping |
| Rolls too easily | CoM too high or track too narrow | Lower CoM; widen track; stiffen anti-roll |
| Bobs on straights | Rear/front frequency mismatched | Rear frequency slightly higher; add pitch damping |
| Floaty at speed | Missing downforce/lift balance or low damping | Add lift/downforce, stiffen dampers |
| Wheels spin forever in air | No wheel inertia or air resistance | Give wheels rotational inertia and a small bearing drag |
| Top speed unrealistic | Missing drag or rolling resistance | Add `½ρCdAv²` and `C_rr·N`; check gearing limits |
| Heavy vehicle handles like a toy | Mass-independent forces | Scale spring/damper, brake, and engine torque to real mass |
| Feels weightless | Too-fast settle, no body inertia | Increase inertia, reduce excessive damping, slow response |

---

## 14. Tuning workflow

1. Set **mass, wheelbase, track, CoM height, and weight distribution** to real numbers.
2. Compute **spring rates** from target frequency (§2.2); damping from `ζ ≈ 0.3` (§2.3); add bump stops.
3. Configure **tire friction curves** and load sensitivity; verify a stationary skid-pad test hits `v = sqrt(μ g R)`.
4. Build the **drivetrain**: engine torque curve, gear ratios, final drive; check the top speed matches drag equilibrium.
5. Add **brakes** with front bias; check a 100→0 km/h stop is ~40 m dry.
6. Add **anti-roll bars** and tune balance with a slow-increasing-speed circle: understeer if it widens, oversteer if it tightens.
7. Add **aerodynamics** and check the top-speed/fuel numbers.
8. Run regression scenarios: static rest on a slope, step steer, braking in a turn, speed bump at various speeds, a jump and landing, a loaded vs. empty comparison, a tow with sway.
9. Verify **numerical robustness**: change the physics rate (60/120/240 Hz) and confirm the same behavior within a few percent.

### Test tracks to build
- **Skid pad**: constant radius, increasing speed → max lateral g.
- **Brake box**: 100 km/h straight stop on each surface.
- **Slalom**: weight transfer and transient response.
- **Washboard / speed bumps**: suspension frequency response.
- **Ramp**: breakover/approach angles and landing.
- **Side slope**: tilt a ramp until the vehicle tips; compare with `atan(t/2h)`.
- **Hill hold**: a parked vehicle on 5/15/30% slopes.

---

## 15. Quick formula sheet

```
Weight                     W = m g
Spring rate from freq      k = m_corner (2π f)²
Damping ratio              ζ = c / (2 √(k m))
Static compression         x = m_corner g / k
Rolling resistance         F_rr = C_rr N
Drag                       F_d = ½ ρ Cd A v²
Downforce                  F_l = ½ ρ Cl A v²
Cornering speed limit      v = √(μ g R)
Rollover threshold         a_lat = g (t / 2h)
Longitudinal transfer      ΔN = m a h / L
Lateral transfer           ΔN = m a_lat h / t
Slope force                F = m g sin θ
Stopping distance          d = v² / (2 μ g)
Kinetic energy             E = ½ m v²
Power from torque          P = τ ω
Wheel torque               T_w = T_e · gear · final · η
Ackermann inside/outside   δ = atan(L / (R ∓ t/2))
Slip ratio                 κ = (ωR − v_x) / |v_x|
Slip angle                 α = atan(v_y / |v_x|)
Buoyancy                   F_b = ρ_w g V
Parallel axis theorem      I = I_cm + m d²
```

---

## 16. The "feel" principles

- **Grip is a budget.** Every action — brake, accelerate, steer — spends from the same four contact patches.
- **Weight moves.** Anything that accelerates the car also shifts load between tires; all handling is the consequence.
- **Transients tell the story.** The first 200 ms of a steering or throttle change defines whether a vehicle feels heavy, nimble, or sloppy.
- **Mass changes everything.** Springs, brakes, engine, and tire loads must scale with real mass, or heavy and light vehicles feel identical.
- **Failure should be progressive.** Grip loss should give warning (squeal, light steering, growing slip) before the cliff; players read and respond to that.
- **Small sensory cues sell realism:** suspension squat and dive, body roll, tire noise rising with slip, engine note tied to RPM, wind noise by speed, dust and spray from surface type, camera shake from impacts, controller vibration from road texture.
- **Stability first, then fidelity.** A slightly simplified model that never explodes beats a perfect one that sometimes does.
