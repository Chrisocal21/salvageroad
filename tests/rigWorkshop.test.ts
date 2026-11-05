// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRigWorkshop } from '../src/ui/rigWorkshop';
import { BOX_REPAIR_PARTS, createRigBuild, RIG_PARTS } from '../src/rules/rigBuild';
import { addItem, countItem, createInventory } from '../src/rules/inventory';

describe('vehicle restoration workshop', () => {
  beforeEach(() => document.body.replaceChildren());
  it('keeps box-truck driving and storage locked until the extended restoration is complete', () => {
    const build = createRigBuild(), pack = createInventory(), drive = vi.fn(), storage = vi.fn();
    Object.assign(build, RIG_PARTS);
    const workshop = createRigWorkshop({ build, pack, cargo: () => undefined, sources: [],
      kind: 'box-truck', changed: vi.fn(), drive, storage });
    workshop.open();
    const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent === text)!;
    expect(document.querySelector('[role=dialog]')?.getAttribute('aria-label')).toBe('Restore box truck');
    expect(button('Drive box truck').disabled).toBe(true);
    expect(button('Open cargo storage (96 slots)').disabled).toBe(true);
    expect(document.querySelectorAll('.hud-control-row')).toHaveLength(23);
    Object.assign(build, BOX_REPAIR_PARTS);
    workshop.open();
    button('Open cargo storage (96 slots)').click();
    expect(storage).toHaveBeenCalledOnce();
    expect(workshop.isOpen()).toBe(false);
    workshop.open();
    button('Drive box truck').click();
    expect(drive).toHaveBeenCalledOnce();
  });
  it('shows assembly-order errors and preserves rejected parts', () => {
    const build = createRigBuild(), pack = createInventory();
    addItem(pack, 'wrench', 1); addItem(pack, 'truck_driver_door', 1);
    const changed = vi.fn();
    const workshop = createRigWorkshop({ build, pack, cargo: () => undefined, sources: [],
      kind: 'box-truck', changed, drive: vi.fn() });
    workshop.open();
    const row = [...document.querySelectorAll('.hud-control-row')].find(r => r.textContent?.startsWith('truck driver door:'))!;
    row.querySelector('button')!.click();
    expect(document.querySelector('[role=status]')?.textContent).toContain('Fit these first');
    expect(countItem(pack, 'truck_driver_door')).toBe(1);
    expect(build.truck_driver_door).toBe(0);
    expect(changed).toHaveBeenCalledOnce();
  });
  it('keeps the original tractor restoration and drive action unchanged', () => {
    const build = createRigBuild(), pack = createInventory(), drive = vi.fn();
    Object.assign(build, RIG_PARTS);
    const workshop = createRigWorkshop({ build, pack, cargo: () => undefined, sources: [], changed: vi.fn(), drive });
    workshop.open();
    expect(document.querySelectorAll('.hud-control-row')).toHaveLength(6);
    [...document.querySelectorAll('button')].find(b => b.textContent === 'Drive big rig')!.click();
    expect(drive).toHaveBeenCalledOnce();
  });
});
