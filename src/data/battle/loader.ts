import type { BattleTableLoader } from '../../core/battleTables';

// Cada import() vira um chunk separado no Vite: o bundle inicial não carrega as tabelas (ADR-004, P-015).
export const bundledBattleTableLoader: BattleTableLoader = {
  species: () => import('./species.json').then((module) => module.default),
  moves: () => import('./moves.json').then((module) => module.default),
  types: () => import('./types.json').then((module) => module.default),
  learnsets: () => import('./learnsets.json').then((module) => module.default),
  machines: () => import('./machines.json').then((module) => module.default),
  evolutions: () => import('./evolutions.json').then((module) => module.default),
  natures: () => import('./natures.json').then((module) => module.default),
};
