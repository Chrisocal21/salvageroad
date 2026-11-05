// The build menu, as data. To add a piece: add a line here, then teach the rules (src/rules/baseBuild.ts)
// and the view (src/render/baseView.ts) what that piece is. The menu itself needs no change.

import type { PieceKind } from '../rules/baseBuild';

export interface BuildItem {
  id: string;
  name: string;
  category: string;
  kind: PieceKind;
}

export const BUILD_ITEMS: BuildItem[] = [
  { id: 'ft10', name: '10 ft container', category: 'Containers', kind: 'ft10' },
  { id: 'ft20', name: '20 ft container', category: 'Containers', kind: 'ft20' },
  { id: 'ft40', name: '40 ft container', category: 'Containers', kind: 'ft40' },
  { id: 'pillar', name: 'Support pillar', category: 'Structure', kind: 'pillar' },
];
