import { countItem, type Inventory } from '../rules/inventory';
import { ITEMS } from '../data/items';
import { WOOD_PARTS, woodMaterials, type WoodKind } from '../rules/woodBuild';
import { HAMMER_LOG_COST } from '../rules/buildHammer';
import { TOOL_RECIPES } from '../rules/woodCraft';
import { icon } from './icons';
import './theme.css';
import './woodBuildMenu.css';

export function createWoodBuildMenu(options: {
  select: (kind: WoodKind) => void;
  craft: () => void;
  craftTool: (id: 'axe' | 'planer') => void;
  plane: () => void;
  canPlane: () => boolean;
  canCraftTools: () => boolean;
  packBench: () => void;
  available: (id: string) => number;
  cargo: () => { items: { name: string; index: number }[]; ready: boolean; reason: string };
  selectContainer: (index: number) => void;
  stop: () => void;
  closed: () => void;
}) {
  const root = document.createElement('div');
  root.className = 'wood-build-menu';
  root.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'wood-workspace';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Wood building and crafting');
  root.append(panel);
  const header = document.createElement('header');
  header.className = 'ui-panel-header';
  const identity = document.createElement('div');
  const eyebrow = document.createElement('div');
  eyebrow.className = 'ui-eyebrow';
  eyebrow.textContent = 'Salvage Road / Fabrication';
  const heading = document.createElement('h1');
  heading.textContent = 'Field workshop';
  identity.append(eyebrow, heading);
  header.append(identity);
  panel.append(header);
  function button(text: string, action: () => void, parent: HTMLElement, glyph?: string) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = glyph ? 'wood-recipe' : 'ui-button';
    if (glyph) element.append(icon(glyph));
    const [name, cost] = text.split(' · ');
    const label = document.createElement('span');
    label.className = 'wood-recipe-label';
    const title = document.createElement('span');
    title.className = 'wood-recipe-name';
    title.textContent = name;
    label.append(title);
    if (cost) {
      const recipe = document.createElement('span');
      recipe.className = 'wood-recipe-cost';
      recipe.textContent = ` · ${cost}`;
      label.append(recipe);
    }
    element.append(label);
    element.addEventListener('click', action);
    parent.append(element);
    return element;
  }
  const closeButton = button('Close · Esc', close, header);
  closeButton.classList.add('ui-close');
  const status = document.createElement('p');
  status.className = 'wood-supplies';
  status.setAttribute('role', 'status');
  panel.append(status);
  const body = document.createElement('div');
  body.className = 'wood-workspace-body';
  const nav = document.createElement('nav');
  nav.className = 'wood-categories';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Workshop categories');
  body.append(nav);
  const content = document.createElement('div');
  content.className = 'wood-content';
  body.append(content);
  panel.append(body);
  const sections = new Map<string, { tab: HTMLButtonElement; panel: HTMLElement }>();
  const instance = document.querySelectorAll('.wood-build-menu').length;
  function section(id: string, name: string, description: string) {
    const pane = document.createElement('div');
    pane.id = `workshop-${instance}-${id}`;
    pane.setAttribute('role', 'tabpanel');
    const tab = button(name, () => selectSection(id), nav);
    tab.id = `${pane.id}-tab`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', pane.id);
    pane.setAttribute('aria-labelledby', tab.id);
    const title = document.createElement('h2');
    title.textContent = name;
    const help = document.createElement('p');
    help.className = 'wood-section-description';
    help.textContent = description;
    const grid = document.createElement('div');
    grid.className = 'wood-build-parts';
    pane.append(title, help, grid);
    content.append(pane);
    sections.set(id, { tab, panel: pane });
    return { pane, grid };
  }
  const construction = section('construction', 'Construction', 'Wood structures and fittings. Choose a piece, then place it in the world.');
  const benches = section('benches', 'Benches', 'Deploy your portable toolbox anywhere on flat ground. Build a planer bench to process logs.');
  const crafting = section('crafting', 'Crafting', 'Tool recipes use carried ingredients. Axes and planers need a nearby toolbox bench.');
  const hauling = section('hauling', 'Containers', 'Real cargo only. Stop beside the hooked flatbed to unload a collected container.');
  let selectedSection = 'construction';
  function selectSection(id: string) {
    selectedSection = id;
    for (const [key, value] of sections) {
      value.panel.hidden = key !== id;
      value.tab.setAttribute('aria-selected', String(key === id));
      value.tab.tabIndex = key === id ? 0 : -1;
    }
  }
  nav.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const keys = [...sections.keys()], current = keys.indexOf(selectedSection);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 :
      (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + keys.length) % keys.length;
    selectSection(keys[next]);
    sections.get(keys[next])!.tab.focus();
  });
  const materialsLabel = (materials: Record<string, number>) =>
    Object.entries(materials).map(([id, count]) => `${count} ${ITEMS[id].name}`).join(' + ');
  const affordable = (pack: Inventory, materials: Record<string, number>) =>
    Object.entries(materials).every(([id, count]) => countItem(pack, id) >= count);
  const craft = button(`Craft build hammer · ${HAMMER_LOG_COST} log`, () => {
    options.craft(); if (inventory) refresh(inventory);
  }, crafting.grid, 'hammer');
  const tools = (['axe', 'planer'] as const).map(id => ({
    id,
    button: button(`Craft ${id} · ${materialsLabel(TOOL_RECIPES[id].ingredients)}`, () => {
      options.craftTool(id); if (inventory) refresh(inventory);
    }, crafting.grid, id),
  }));
  const plane = button('Plane 1 log into 4 planks', () => {
    options.plane(); if (inventory) refresh(inventory);
  }, crafting.grid, 'planks');
  const packBench = button('Pack up toolbox bench', () => {
    options.packBench(); if (inventory) refresh(inventory);
  }, benches.pane);
  packBench.classList.add('wood-pack-bench');
  const selections = (Object.keys(WOOD_PARTS) as WoodKind[]).map(kind => ({
    kind,
    button: button(`${WOOD_PARTS[kind].name} · ${materialsLabel(woodMaterials(kind))}`, () => {
      close(); options.select(kind);
    }, kind === 'basicbench' || kind === 'workbench' ? benches.grid : construction.grid,
    kind === 'basicbench' ? 'toolbox' : kind === 'workbench' ? 'planer' : kind === 'garage' ? 'door' : kind === 'deck' ? 'floor' : kind),
  }));
  const cargoStatus = document.createElement('p');
  cargoStatus.className = 'wood-cargo-status';
  hauling.pane.insertBefore(cargoStatus, hauling.grid);
  const footer = document.createElement('footer');
  footer.className = 'wood-footer';
  const manual = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Field guide & controls';
  const help = document.createElement('p');
  help.textContent = 'Loot logs or chop trees with an axe. Deploy the toolbox without a hammer; craft tools beside it. One log crafts a hammer. A planer bench costs 6 logs + 1 planer; use E or open K near the bench to turn logs into planks. Build using your pack or item storage within 8 m. LMB places, R rotates, PgUp/PgDn changes height. RMB dismantles without refunds; RMB a portable toolbox to pick it up without losing it. E operates doors. Containers: U / flatbed. Metal upgrades and other benches are not implemented.';
  manual.append(summary, help);
  footer.append(manual);
  button('Unequip hammer / finish building', () => { close(); options.stop(); }, footer);
  panel.append(footer);
  document.body.append(root);
  let inventory: Inventory | undefined;
  let previousFocus: HTMLElement | null = null;
  selectSection(selectedSection);

  function refresh(pack: Inventory) {
    const focused = document.activeElement;
    const hadFocus = panel.contains(focused);
    inventory = pack;
    const logs = countItem(pack, 'log'), wood = countItem(pack, 'wood');
    const hasHammer = countItem(pack, 'build_hammer') > 0;
    status.textContent = `${logs} logs · ${wood} wood planks available · ${hasHammer ? 'Build hammer ready' : 'Build hammer required for pieces'}`;
    craft.disabled = hasHammer || logs < HAMMER_LOG_COST;
    craft.title = hasHammer ? 'You already have a build hammer' : `Requires ${HAMMER_LOG_COST} log`;
    for (const tool of tools) {
      tool.button.disabled = !options.canCraftTools() || !affordable(pack, TOOL_RECIPES[tool.id].ingredients);
      tool.button.title = `Requires a nearby starter toolbox bench and ${materialsLabel(TOOL_RECIPES[tool.id].ingredients)} in your pack`;
    }
    packBench.disabled = !options.canCraftTools();
    packBench.title = 'Pack into your inventory. Requires room for the toolbox.';
    plane.disabled = !logs || !options.canPlane();
    plane.title = 'Requires 1 log and a nearby placed planer bench';
    const cargo = options.cargo();
    cargoStatus.textContent = !cargo.ready ? cargo.reason : cargo.items.length ? 'Carried flatbed stock' : 'No containers carried on the flatbed';
    cargoStatus.classList.toggle('ui-empty', !cargo.items.length);
    hauling.grid.replaceChildren();
    for (const item of cargo.items) {
      const container = button(item.name, () => { close(); options.selectContainer(item.index); }, hauling.grid, 'container');
      container.disabled = !cargo.ready;
      container.title = cargo.ready ? 'Place this carried container' : cargo.reason;
    }
    for (const selection of selections) {
      const materials = woodMaterials(selection.kind), needsHammer = selection.kind !== 'basicbench';
      selection.button.disabled = (needsHammer && !hasHammer) ||
        !Object.entries(materials).every(([id, count]) => options.available(id) >= count);
      selection.button.title = needsHammer && !hasHammer ? 'Requires a build hammer' :
        `Requires ${materialsLabel(materials)} from your pack or nearby vehicle`;
    }
    if (!root.hidden && hadFocus && (!focused?.isConnected || (focused as HTMLButtonElement).disabled)) closeButton.focus();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus();
    options.closed();
  }
  function visibleControls() {
    return [...panel.querySelectorAll<HTMLElement>('button, summary')].filter(button =>
      !button.matches(':disabled') && !button.closest('[hidden]') &&
      (button.getAttribute('role') !== 'tab' || button.tabIndex === 0));
  }
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') {
      const buttons = visibleControls(), index = buttons.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0) :
        (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  });
  root.addEventListener('keyup', event => event.stopPropagation());
  root.addEventListener('keypress', event => event.stopPropagation());
  return {
    open(pack: Inventory) {
      if (root.hidden) previousFocus = document.activeElement as HTMLElement | null;
      refresh(pack);
      if (!countItem(pack, 'build_hammer') && options.available('basic_bench')) selectSection('benches');
      else if (options.canPlane() || options.canCraftTools()) selectSection('crafting');
      root.hidden = false;
      closeButton.focus();
    },
    refresh, close, isOpen: () => !root.hidden,
  };
}
