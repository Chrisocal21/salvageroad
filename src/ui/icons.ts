import { ITEMS } from '../data/items';

const paths: Record<string, string> = {
  toolbox: 'M3 9h18v11H3z M8 9V5h8v4 M3 13h18 M10 12v3h4v-3',
  hammer: 'm7 4 10 0 3 4-5 3-3-3-7 12-3-2 7-12-3-1z',
  axe: 'm6 21 9-17 M12 4c4-3 7-1 9 2l-4 5-6-4',
  planer: 'M3 14h18v5H3z M6 14l3-7h9l2 7 M10 7V4h5v3',
  logs: 'M5 8h13a3 3 0 0 1 0 6H5 M5 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M8 14v4h12v-4',
  planks: 'm3 7 15-3 3 4-15 3z M4 12l16-3 1 4-16 3z M5 17l16-3v4L6 21z',
  food: 'M6 4h12v16H6z M6 8h12 M6 16h12 M9 4V2h6v2',
  drink: 'M9 3h6v4l3 4v10H6V11l3-4z M9 15h6',
  medical: 'M4 5h16v15H4z M9 2h6v3 M12 9v7 M8.5 12.5h7',
  part: 'm9 3 6 0 1 3 3 1 2 5-2 4-3 1-1 4H9l-1-4-3-1-2-4 2-5 3-1z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  tool: 'M15 3a5 5 0 0 0-5 7L3 17l4 4 7-7a5 5 0 0 0 7-5l-4 2-3-3 2-5z',
  material: 'M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11',
  door: 'M6 22V2h12v20 M9 22V5h6v17 M12 13h1',
  window: 'M3 5h18v14H3z M6 8h12v8H6z M12 8v8',
  wall: 'M3 3h18v18H3z M8 3v18 M16 3v18 M3 8h18 M3 16h18',
  floor: 'm2 9 10-5 10 5-10 11z M6 11l10-5 M10 15l10-6 M14 16l-8-7',
  stairs: 'M3 21v-5h6v-5h6V6h6v15z M3 21h18',
  railing: 'M3 6h18 M3 12h18 M4 6v14 M10 6v14 M16 6v14 M20 6v14',
  container: 'M2 5h20v14H2z M6 5v14 M10 5v14 M14 5v14 M18 5v14',
};

export function itemIcon(id: string): SVGSVGElement {
  const def = ITEMS[id];
  const kind = id === 'basic_bench' ? 'toolbox' : id === 'build_hammer' ? 'hammer' :
    id === 'log' ? 'logs' : id === 'wood' ? 'planks' : paths[id] ? id : def.kind;
  return icon(kind);
}

export function icon(kind: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('ui-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[kind] ?? paths.material);
  svg.append(path);
  return svg;
}
