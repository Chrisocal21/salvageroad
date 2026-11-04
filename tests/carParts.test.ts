import { describe, expect, it } from 'vitest';
import { checkFit, completeCarBuild, createCarBuild, describeMissing, fitPart, isComplete, PARTS, PART_KINDS } from '../src/rules/carParts';
import { addItem, createInventory } from '../src/rules/inventory';

const withWrench = () => {
  const inv = createInventory();
  addItem(inv, 'wrench', 1);
  return inv;
};

describe('putting the El Cajon back together', () => {
  it('starts with nothing on, and lists what is missing', () => {
    const build = createCarBuild();
    expect(isComplete(build)).toBe(false);
    expect(describeMissing(build)).toBe("engine, battery, hood, 4 wheels, bench seat, front bumper, rear bumper, tailgate, dashboard, steering wheel, windshield, driver's door, passenger door, grille, headlights");
  });

  it('needs a wrench to bolt anything on', () => {
    const build = createCarBuild();
    const r = fitPart(build, 'wheel', createInventory());
    expect(r.ok).toBe(false);
    expect(build.wheel).toBe(0);
    if (!r.ok) expect(r.reason).toContain('wrench');
  });

  it('lets the hood go on first, and then needs it open to get at the engine and battery', () => {
    const build = createCarBuild();
    const inv = withWrench();
    expect(fitPart(build, 'hood', inv, false).ok).toBe(true);
    const shut = checkFit(build, 'engine', inv, false);
    expect(shut.ok).toBe(false);
    if (!shut.ok) expect(shut.reason).toBe('Open the hood first to get at the engine');
    expect(checkFit(build, 'battery', inv, false).ok).toBe(false);
    expect(fitPart(build, 'engine', inv, true).ok).toBe(true);
    expect(fitPart(build, 'battery', inv, true).ok).toBe(true);
    // Parts that are not under the hood do not care whether it is open.
    expect(fitPart(build, 'seat', inv, false).ok).toBe(true);
  });

  it('needs the hood open only if it is on', () => {
    const build = createCarBuild();
    const inv = withWrench();
    expect(checkFit(build, 'engine', inv, false).ok).toBe(true); // no hood on yet: nothing in the way
  });


  it('takes four wheels and no more', () => {
    const build = createCarBuild();
    const inv = withWrench();
    for (let i = 0; i < 4; i++) expect(fitPart(build, 'wheel', inv).ok).toBe(true);
    expect(build.wheel).toBe(4);
    expect(describeMissing(build).split(', ').filter((m) => /^(\d )?wheels?$/.test(m))).toEqual([]);
    expect(fitPart(build, 'wheel', inv).ok).toBe(false);
    expect(build.wheel).toBe(4);
  });

  it('is complete, and drivable, with every part on', () => {
    const build = createCarBuild();
    const inv = withWrench();
    for (const kind of PART_KINDS) for (let i = 0; i < PARTS[kind].count; i++) expect(fitPart(build, kind, inv).ok).toBe(true);
    expect(isComplete(build)).toBe(true);
    expect(describeMissing(build)).toBe('');
    expect(build).toEqual(completeCarBuild());
  });

  it('builds the dashboard before the steering wheel and glass, and the grille before the headlights', () => {
    const build = createCarBuild();
    const inv = withWrench();
    const early = checkFit(build, 'steering_wheel', inv);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe('The dashboard must go in before the steering wheel');
    expect(checkFit(build, 'windshield', inv).ok).toBe(false);
    const door = checkFit(build, 'driver_door', inv);
    expect(door.ok).toBe(false);
    if (!door.ok) expect(door.reason).toBe("The dashboard and bench seat must go in before the driver's door");
    expect(checkFit(build, 'headlights', inv).ok).toBe(false);
    for (const kind of ['dash', 'seat', 'steering_wheel', 'windshield', 'driver_door', 'passenger_door', 'engine', 'grille', 'headlights'] as const) {
      expect(fitPart(build, kind, inv).ok).toBe(true);
    }
  });
});
