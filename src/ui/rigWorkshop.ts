import { ITEMS } from '../data/items';
import { countItem, type Inventory } from '../rules/inventory';
import { fitRigPart, rigRequirements, partsForRig, rigComplete, rigLabel, type RigBuild, type RigPart, type RigKind } from '../rules/rigBuild';
import { itemIcon } from './icons';
import './theme.css';
import './hud.css';

export function createRigWorkshop(options: {
  build: RigBuild; pack: Inventory; cargo: () => Inventory | undefined;
  sources: {item: RigPart; x:number; z:number}[];
  changed: () => void; drive: () => void;
  kind?: RigKind; storage?: () => void;
}) {
  const kind = options.kind ?? 'tractor', name = rigLabel(kind), requirements = rigRequirements(kind);
  const root = document.createElement('div'); root.className = 'hud hud-workshop'; root.hidden = true;
  const overlay = document.createElement('div'); overlay.className = 'hud-pause-overlay'; root.append(overlay);
  const panel = document.createElement('section'); panel.className = 'hud-pause'; overlay.append(panel);
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label',`Restore ${name}`);
  document.body.append(root);
  let message = '';
  function render() {
    const focusedPart = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.part : undefined;
    panel.replaceChildren();
    const eyebrow = document.createElement('div'); eyebrow.className = 'ui-eyebrow'; eyebrow.textContent = 'Salvage Road / Vehicle restoration'; panel.append(eyebrow);
    const heading = document.createElement('h1'); heading.textContent = `Restore the ${name}`; panel.append(heading);
    const help = document.createElement('p');
    help.className = 'hud-pause-description';
    help.textContent = 'A wrench is required. Install parts from your pack or the El Cajon within 8 m. Scavenge missing components or barter at the yard.';
    panel.append(help);
    const cargo = options.cargo();
    const nearby = document.createElement('p'); nearby.className = 'ui-section-label'; nearby.textContent = cargo ? 'Cargo link / El Cajon in range' : 'Cargo link / Pack only'; panel.append(nearby);
    const total = partsForRig(kind).reduce((n, id) => n + requirements[id]!, 0);
    const installed = partsForRig(kind).reduce((n, id) => n + Math.min(options.build[id], requirements[id]!), 0);
    const progress = document.createElement('progress'); progress.className = 'hud-rig-progress'; progress.max = total; progress.value = installed;
    progress.setAttribute('aria-label', `Restoration: ${installed} of ${total} parts installed`); panel.append(progress);
    const list = document.createElement('div'); list.className = 'hud-rig-parts'; panel.append(list);
    for (const id of partsForRig(kind)) {
      const row = document.createElement('div'); row.className = 'hud-control-row'; list.append(row);
      const label = document.createElement('span'); label.textContent = `${ITEMS[id].name}: ${options.build[id]} / ${requirements[id]}`; row.append(label);
      label.prepend(itemIcon(id));
      const available = countItem(options.pack,id) + (cargo ? countItem(cargo,id) : 0);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hud-resume';
      button.textContent = options.build[id] >= requirements[id]! ? 'Installed' : `Fit one (${available} available)`;
      button.dataset.part = id;
      button.disabled = options.build[id] >= requirements[id]! || !available || !countItem(options.pack,'wrench');
      button.addEventListener('click', () => { message = fitRigPart(options.build,id,options.pack,options.cargo(),kind).message; options.changed(); render(); });
      row.append(button);
    }
    const status = document.createElement('p'); status.className = 'hud-rig-status'; status.setAttribute('role','status'); status.textContent = message || (rigComplete(options.build,kind) ? 'Complete. Ready to drive.' : kind === 'box-truck' ? `${installed} / ${total} parts installed. Cab, mechanical and cargo assemblies required. Dashboard/seats precede doors; walls precede roof.` : `${installed} / ${total} parts installed. Restore the drivetrain and fit all ten tires.`); panel.append(status);
    const actions = document.createElement('div'); actions.className = 'hud-rig-actions'; panel.append(actions);
    const drive = document.createElement('button'); drive.type = 'button'; drive.className = 'hud-resume'; drive.textContent = `Drive ${name}`; drive.disabled = !rigComplete(options.build,kind);
    drive.addEventListener('click', () => { close(); options.drive(); }); actions.append(drive);
    if (options.storage) {
      const storage = document.createElement('button'); storage.type = 'button'; storage.className = 'hud-resume';
      storage.textContent = 'Open cargo storage (96 slots)'; storage.disabled = !rigComplete(options.build,kind);
      storage.addEventListener('click', () => { close(); options.storage!(); }); actions.append(storage);
    }
    const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'hud-resume'; closeButton.textContent = 'Close · Esc'; closeButton.addEventListener('click',close); actions.append(closeButton);
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Scavenging leads (map coordinates)'; details.append(summary);
    for (const source of options.sources.filter(source => requirements[source.item])) { const p = document.createElement('p'); p.textContent = `${ITEMS[source.item].name} — x ${Math.round(source.x)}, z ${Math.round(source.z)}`; details.append(p); }
    panel.append(details);
    const restoreFocus = focusedPart ? [...list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].find(button => button.dataset.part === focusedPart) : undefined;
    (restoreFocus ?? closeButton).focus();
  }
  function close() { root.hidden = true; }
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), summary')];
    const index = controls.indexOf(document.activeElement as HTMLElement);
    event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });
  return { open() { root.hidden = false; message = ''; render(); }, close, isOpen: () => !root.hidden };
}
