import { listDexSpecies, type DexSpecies } from '../core/dex';
import type { PokedexState } from '../core/pokedex';

export function pokedexCounts(pokedex: PokedexState): { seen: number; caught: number } {
  return { seen: pokedex.seenSpecies.length, caught: pokedex.caughtSpecies.length };
}

export function pokedexSpeciesStatus(pokedex: PokedexState, speciesId: string): 'Capturado' | 'Visto' | '---' {
  if (pokedex.caughtSpecies.includes(speciesId)) return 'Capturado';
  if (pokedex.seenSpecies.includes(speciesId)) return 'Visto';
  return '---';
}

export function pokedexEntries(pokedex: PokedexState): Array<{ species: DexSpecies; status: 'Capturado' | 'Visto' | '---' }> {
  return listDexSpecies().map((species) => ({ species, status: pokedexSpeciesStatus(pokedex, species.id) }));
}

export function renderPokedexTab(pokedex: PokedexState, panel: HTMLElement): void {
  const counts = pokedexCounts(pokedex);
  const summary = document.createElement('div');
  summary.className = 'oras-dex-summary';
  summary.textContent = `Vistos ${counts.seen} · Capturados ${counts.caught}`;
  panel.appendChild(summary);

  const grid = document.createElement('div');
  grid.className = 'oras-dex-grid';
  pokedexEntries(pokedex).forEach(({ species }) => grid.appendChild(createPokedexCell(pokedex, species)));
  panel.appendChild(grid);
}

function createPokedexCell(pokedex: PokedexState, species: DexSpecies): HTMLElement {
  const status = pokedexSpeciesStatus(pokedex, species.id);
  const cell = document.createElement('div');
  cell.className = `ds-item${status === 'Capturado' ? ' caught' : status === 'Visto' ? ' seen' : ''}`;
  const details = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = `#${species.dexNumber} ${species.name}`;
  const types = document.createElement('div');
  types.style.color = '#94a3b8';
  types.textContent = species.types.join('/');
  details.append(title, types);
  const label = document.createElement('span');
  label.textContent = status;
  cell.append(details, label);
  return cell;
}
