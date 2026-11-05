// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWoodBuildMenu } from '../src/ui/woodBuildMenu';
import { WOOD_PARTS, woodMaterials, type WoodKind } from '../src/rules/woodBuild';
import { HAMMER_LOG_COST } from '../src/rules/buildHammer';
import { TOOL_RECIPES } from '../src/rules/woodCraft';
import { countItem, type Inventory } from '../src/rules/inventory';
import { ITEMS } from '../src/data/items';

const pack = (wood: number, hammer = false): Inventory => ({
  slots: [{ id: 'wood', count: wood }, ...(hammer ? [{ id: 'build_hammer', count: 1 }] : [])],
});
const materialsPack = (materials: Record<string, number>, hammer = false): Inventory => ({
  slots: [...Object.entries(materials).map(([id, count]) => ({ id, count })),
    ...(hammer ? [{ id: 'build_hammer', count: 1 }] : [])],
});
const find = (text: string) => [...document.querySelectorAll('button')]
  .find(button => button.textContent?.startsWith(text))!;
const setup = () => {
  let current = pack(0);
  const options = {
    select: vi.fn(), craft: vi.fn(), stop: vi.fn(), closed: vi.fn(),
    craftTool: vi.fn(), plane: vi.fn(), canPlane: vi.fn(() => false),
    canCraftTools: vi.fn(() => true),
    packBench: vi.fn(),
    available: vi.fn((id: string) => countItem(current, id)),
    cargo: vi.fn((): { items: { name: string; index: number }[]; ready: boolean; reason: string } =>
      ({ items: [], ready: false, reason: 'Park near your base to place containers' })),
    selectContainer: vi.fn(),
  };
  const menu = createWoodBuildMenu(options);
  return {
    menu: {
      ...menu,
      open(inventory: Inventory) { current = inventory; menu.open(inventory); },
      refresh(inventory: Inventory) { current = inventory; menu.refresh(inventory); },
    },
    options,
  };
};

describe('wood building menu', () => {
  beforeEach(() => document.body.replaceChildren());

  it('switches categories with arrow keys and keeps keyboard focus in visible controls', () => {
    const { menu } = setup();
    menu.open(pack(100, true));
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    tabs[0].click();
    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
    expect(document.querySelector('[role=tabpanel]:not([hidden]) h2')?.textContent).toBe('Benches');
    expect(tabs[0].tabIndex).toBe(-1);
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement?.closest('[role=tabpanel]')?.getAttribute('aria-labelledby')).toBe(tabs[1].id);
    const summary = document.querySelector('summary')!;
    summary.focus();
    summary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(find('Unequip'));
    summary.focus();
    summary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.isOpen()).toBe(false);
  });

  it('opens an accessible dialog, focuses its first button and restores focus on close', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { menu, options } = setup();
    expect(menu.isOpen()).toBe(false);
    menu.open(pack(0));
    expect(document.querySelector('[role=dialog]')?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(find('Close'));
    menu.close();
    menu.close();
    expect(options.closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });

  it('gates hammer crafting on logs rather than planks and refreshes after crafting', () => {
    const { menu, options } = setup();
    menu.open(pack(100));
    expect(find('Craft build hammer').disabled).toBe(true);
    const inventory = materialsPack({ log: HAMMER_LOG_COST });
    menu.refresh(inventory);
    expect(find('Craft build hammer').disabled).toBe(false);
    expect(find('Craft build hammer').textContent).toContain('1 log');
    options.craft.mockImplementation(() => inventory.slots.push({ id: 'build_hammer', count: 1 }));
    find('Craft build hammer').click();
    expect(options.craft).toHaveBeenCalledOnce();
    expect(find('Craft build hammer').disabled).toBe(true);
    expect(menu.isOpen()).toBe(true);
  });

  it('requires a hammer and each piece cost, selects every wood kind, and closes', () => {
    const { menu, options } = setup();
    for (const kind of Object.keys(WOOD_PARTS) as WoodKind[]) {
      const part = WOOD_PARTS[kind];
      const materials = woodMaterials(kind);
      menu.open(materialsPack(materials));
      expect(find(`${part.name} ·`).disabled).toBe(kind !== 'basicbench');
      for (const id of Object.keys(materials)) {
        menu.refresh(materialsPack({ ...materials, [id]: materials[id] - 1 }, true));
        expect(find(`${part.name} ·`).disabled).toBe(true);
      }
      menu.refresh(materialsPack(materials, true));
      const piece = find(`${part.name} ·`);
      for (const [id, count] of Object.entries(materials)) {
        expect(piece.textContent).toContain(`${count} ${ITEMS[id].name}`);
      }
      expect(piece.disabled).toBe(false);
      piece.click();
      expect(options.select).toHaveBeenLastCalledWith(kind);
      expect(menu.isOpen()).toBe(false);
    }
    expect(options.closed).toHaveBeenCalledTimes(Object.keys(WOOD_PARTS).length);
  });

  it('shows the special workbench recipe and never treats its zero wood cost as free', () => {
    const { menu } = setup();
    menu.open(pack(100, true));
    const bench = find('Wood planer bench');
    expect(bench.disabled).toBe(true);
    expect(bench.textContent).toContain('6 log + 1 planer');
    menu.refresh(materialsPack({ log: 6, planer: 1 }, true));
    expect(bench.disabled).toBe(false);
    expect(document.querySelector('[role=status]')?.textContent).toContain('6 logs · 0 wood planks');
  });

  it('requires every tool ingredient and refreshes after each crafting action', () => {
    const { menu, options } = setup();
    for (const id of ['axe', 'planer'] as const) {
      const recipe = TOOL_RECIPES[id].ingredients;
      menu.open(materialsPack(recipe));
      const craft = find(`Craft ${id}`);
      expect(craft.disabled).toBe(false);
      for (const ingredient of Object.keys(recipe)) {
        menu.refresh(materialsPack({ ...recipe, [ingredient]: recipe[ingredient] - 1 }));
        expect(craft.disabled).toBe(true);
        craft.click();
        expect(options.craftTool).not.toHaveBeenCalled();
      }
      const inventory = materialsPack(recipe);
      menu.refresh(inventory);
      options.craftTool.mockImplementation(() => { inventory.slots = []; });
      craft.click();
      expect(options.craftTool).toHaveBeenCalledWith(id);
      expect(craft.disabled).toBe(true);
      expect(menu.isOpen()).toBe(true);
      options.craftTool.mockClear();
    }
    expect(find('Craft axe').textContent).toContain('2 log + 3 scrap metal + 1 rope');
    expect(find('Craft planer').textContent).toContain('2 log + 6 scrap metal');
  });

  it('requires the deployed toolbox bench for tool crafting but not for hammer crafting', () => {
    const { menu, options } = setup();
    options.canCraftTools.mockReturnValue(false);
    const inventory = materialsPack({ log: 10, scrap_metal: 10, rope: 1 });
    menu.open(inventory);
    expect(find('Craft axe').disabled).toBe(true);
    expect(find('Craft planer').disabled).toBe(true);
    expect(find('Craft build hammer').disabled).toBe(false);
    expect(find('Craft axe').title).toContain('starter toolbox bench');
    options.canCraftTools.mockReturnValue(true);
    menu.refresh(inventory);
    expect(find('Craft axe').disabled).toBe(false);
    expect(find('Craft planer').disabled).toBe(false);
    expect(document.body.textContent).toContain('pick it up without losing it');
  });

  it('packs a nearby toolbox bench without a hammer, stays open and refreshes', () => {
    const { menu, options } = setup();
    options.canCraftTools.mockReturnValue(false);
    const inventory = pack(0);
    menu.open(inventory);
    const pickup = find('Pack up toolbox bench');
    expect(pickup.disabled).toBe(true);
    pickup.click();
    expect(options.packBench).not.toHaveBeenCalled();
    options.canCraftTools.mockReturnValue(true);
    menu.refresh(inventory);
    expect(pickup.disabled).toBe(false);
    options.packBench.mockImplementation(() => {
      inventory.slots.push({ id: 'basic_bench', count: 1 });
      options.canCraftTools.mockReturnValue(false);
    });
    pickup.click();
    expect(options.packBench).toHaveBeenCalledOnce();
    expect(menu.isOpen()).toBe(true);
    expect(pickup.disabled).toBe(true);
    expect(find(`${WOOD_PARTS.basicbench.name} ·`).disabled).toBe(false);
    expect(find('Craft axe').disabled).toBe(true);
  });

  it('places a stored starter bench without a hammer and uses nearby storage only for building', () => {
    const { menu, options } = setup();
    const stored: Record<string, number> = {
      basic_bench: 1, log: 6, planer: 1, wood: 100, scrap_metal: 10, rope: 1,
    };
    options.available.mockImplementation(id => stored[id] ?? 0);
    menu.open(pack(0));
    const bench = find(`${WOOD_PARTS.basicbench.name} ·`);
    expect(bench.disabled).toBe(false);
    expect(find('Wood planer bench').disabled).toBe(true);
    expect(find('Craft build hammer').disabled).toBe(true);
    expect(find('Craft axe').disabled).toBe(true);
    expect(find('Craft planer').disabled).toBe(true);
    bench.click();
    expect(options.select).toHaveBeenCalledWith('basicbench');
    expect(menu.isOpen()).toBe(false);
    menu.open(pack(0, true));
    expect(find('Wood planer bench').disabled).toBe(false);
    options.available.mockReturnValue(0);
    menu.refresh(pack(100, true));
    expect(bench.disabled).toBe(true);
    expect(find('Wood planer bench').disabled).toBe(true);
  });

  it('gates processing on a nearby workbench and logs, then refreshes inventory', () => {
    const { menu, options } = setup();
    const inventory = materialsPack({ log: 1 });
    menu.open(inventory);
    const plane = find('Plane 1 log into 4 planks');
    expect(plane.disabled).toBe(true);
    plane.click();
    expect(options.plane).not.toHaveBeenCalled();
    options.canPlane.mockReturnValue(true);
    menu.refresh(pack(100));
    expect(plane.disabled).toBe(true);
    menu.refresh(inventory);
    expect(plane.disabled).toBe(false);
    options.plane.mockImplementation(() => { inventory.slots = [{ id: 'wood', count: 4 }]; });
    plane.click();
    expect(options.plane).toHaveBeenCalledOnce();
    expect(plane.disabled).toBe(true);
    expect(menu.isOpen()).toBe(true);
    expect(document.querySelector('[role=status]')?.textContent).toContain('0 logs · 4 wood planks');
    expect(document.body.textContent).toContain('chop trees with an axe');
    expect(document.body.textContent).toContain('open K near the bench');
  });

  it('shows flatbed stock and placement reasons and closes before selecting its cargo index', () => {
    const { menu, options } = setup();
    options.cargo.mockReturnValue({
      items: [{ name: 'Red container', index: 4 }, { name: 'Blue container', index: 9 }],
      ready: false, reason: 'Park near your base',
    });
    menu.open(pack(0));
    find('Containers').click();
    expect(document.querySelector('[role=tabpanel]:not([hidden]) h2')?.textContent).toBe('Containers');
    expect(document.body.textContent).toContain('Park near your base');
    expect(find('Red container').disabled).toBe(true);
    find('Red container').click();
    expect(options.selectContainer).not.toHaveBeenCalled();
    options.cargo.mockReturnValue({
      items: [{ name: 'Blue container', index: 9 }], ready: true, reason: '',
    });
    menu.refresh(pack(0));
    expect(document.body.textContent).not.toContain('Red container');
    expect(document.body.textContent).not.toContain('Park near your base');
    options.selectContainer.mockImplementation(() => expect(menu.isOpen()).toBe(false));
    find('Blue container').click();
    expect(options.selectContainer).toHaveBeenCalledWith(9);
    expect(options.closed).toHaveBeenCalledOnce();
    options.cargo.mockReturnValue({ items: [], ready: true, reason: '' });
    menu.open(pack(0));
    expect(document.body.textContent).toContain('No containers carried');
  });

  it('closes before stopping and explains the controls and unavailable upgrades', () => {
    const { menu, options } = setup();
    menu.open(pack(0));
    options.stop.mockImplementation(() => expect(menu.isOpen()).toBe(false));
    expect(document.body.textContent).toContain('PgUp/PgDn');
    expect(document.body.textContent).toContain('U / flatbed');
    expect(document.body.textContent).toContain('not implemented');
    find('Unequip').click();
    expect(options.stop).toHaveBeenCalledOnce();
    expect(options.closed).toHaveBeenCalledOnce();
  });

  it('traps Tab both ways, isolates game hotkeys and closes with Escape', () => {
    const { menu, options } = setup();
    const gameKeys = vi.fn();
    document.addEventListener('keydown', gameKeys);
    try {
      menu.open(pack(0));
      const close = find('Close'), stop = find('Unequip');
      close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      expect(document.activeElement).toBe(stop);
      stop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      expect(document.activeElement).toBe(document.querySelector('summary'));
      document.querySelector('summary')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(document.activeElement).toBe(stop);
      stop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(document.activeElement).toBe(close);
      close.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(gameKeys).not.toHaveBeenCalled();
      expect(options.closed).toHaveBeenCalledOnce();
      expect(menu.isOpen()).toBe(false);
    } finally {
      document.removeEventListener('keydown', gameKeys);
    }
  });
});
