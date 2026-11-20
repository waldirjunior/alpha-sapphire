import type { BagState } from '../core/bag';
import { usePotion } from '../core/bag';
import type { BattleState, PokemonInstance } from '../core/battle';
import type { PokedexState } from '../core/pokedex';
import {
  HOENN_LOCATIONS,
  HOENN_MAP_CONNECTIONS,
  HOENN_MAP_VIEWBOX,
  resolveHoennLocation,
} from '../core/hoennMap';
import { createHpBarMarkup } from './battleUi';
import { bindAudioControls, type AudioControlsHost } from './audioControls';
import { renderPokedexTab } from './pokedexMenu';
export { pokedexCounts, pokedexEntries, pokedexSpeciesStatus } from './pokedexMenu';

export type MenuTab = 'party' | 'bag' | 'pokedex' | 'time' | 'map';
export type BagPocket = 'items' | 'balls' | 'key';
export interface BagPocketItem {
  label: string;
  count: number;
  desc: string;
}

export interface MenuTabPresentation {
  label: string;
  icon: string;
  accessibleName: string;
}

const MENU_TAB_PRESENTATIONS: Record<MenuTab, MenuTabPresentation> = {
  party: { label: 'Equipe', icon: '●', accessibleName: 'Abrir equipe' },
  bag: { label: 'Mochila', icon: '▣', accessibleName: 'Abrir mochila' },
  pokedex: { label: 'Pokédex', icon: '⬡', accessibleName: 'Abrir Pokédex' },
  time: { label: 'Hora', icon: '◷', accessibleName: 'Abrir hora' },
  map: { label: 'Mapa', icon: '⌖', accessibleName: 'Abrir Mapa de Hoenn' },
};

export interface DialogueLine {
  speaker: string;
  text: string;
}

export function menuTabPresentation(tab: MenuTab): MenuTabPresentation {
  return MENU_TAB_PRESENTATIONS[tab];
}

export function formatPlayNavTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function splitDialogueSpeaker(text: string): DialogueLine {
  const match = /^([^:\n]{1,32}):\s*/u.exec(text);
  if (!match) return { speaker: '', text };
  return { speaker: match[1] ?? '', text: text.slice(match[0].length) };
}

export function toggleMenuTab(current: MenuTab | null, selected: MenuTab): MenuTab | null {
  return current === selected ? null : selected;
}

export function bagPocketItems(bag: BagState, pocket: BagPocket): BagPocketItem[] {
  if (pocket === 'items') return [{ label: 'Potion', count: bag.potions, desc: 'Restaura 20 HP de um Pokémon.' }];
  if (pocket === 'balls') return [{ label: 'Poké Ball', count: bag.pokeballs, desc: 'Captura Pokémon selvagens em batalha.' }];
  if (bag.keyItems.length) return bag.keyItems.map((label) => ({ label, count: 1, desc: 'Item-chave de aventura.' }));
  return [{ label: 'PokéNav Plus', count: 1, desc: 'Equipado na tela inferior do 3DS.' }];
}

export interface MenuHost {
  panel: HTMLElement | null;
  tabButtons: NodeListOf<HTMLButtonElement>;
  getOpenTab(): MenuTab | null;
  setOpenTab(tab: MenuTab | null): void;
  getActiveBattle(): BattleState | null;
  getParty(): PokemonInstance[];
  getPokedex(): PokedexState;
  getBag(): BagState;
  setBag(bag: BagState): void;
  setParty(party: PokemonInstance[]): void;
  getActiveBagPocket(): BagPocket;
  setActiveBagPocket(pocket: BagPocket): void;
  getPlayerMap(): { mapId: string; zoneName?: string };
  getSelectedMapLocationId(): string | null;
  setSelectedMapLocationId(locationId: string): void;
  renderIntro(): void;
  syncUi(): void;
}

export type StarterId = 'treecko' | 'torchic' | 'mudkip';

export interface MenuControlHost extends AudioControlsHost {
  tabButtons: NodeListOf<HTMLButtonElement>;
  getOpenTab(): MenuTab | null;
  setOpenTab(tab: MenuTab | null): void;
  resetButton: HTMLElement | null;
  newGameButton: HTMLElement | null;
  saveButton: HTMLElement | null;
  starterButtons: NodeListOf<HTMLButtonElement>;
  window: Window;
  startNewGame(): void;
  isBattleActive(): boolean;
  createStarter(id: StarterId): PokemonInstance;
  onStarterSelected?(id: StarterId): void;
  getParty(): PokemonInstance[];
  setParty(party: PokemonInstance[]): void;
  setStarterId(id: StarterId): void;
  persistSave(): void;
  syncUi(): void;
  renderDsPanel(): void;
}

export function bindMenuEvents(host: MenuControlHost): void {
  bindTabEvents(host);
  bindNewGameButtons(host);
  bindStarterButtons(host);
  bindSaveButton(host);
  bindAudioControls(host);
}

function bindTabEvents(host: MenuControlHost): void {
  host.tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = menuTabFrom(button.dataset.tab);
      if (!tab) return;
      host.setOpenTab(toggleMenuTab(host.getOpenTab(), tab));
      host.renderDsPanel();
      button.blur();
    });
  });
}

export function menuTabFrom(value: string | undefined): MenuTab | null {
  return value === 'party' || value === 'bag' || value === 'pokedex' || value === 'time' || value === 'map' ? value : null;
}

function bindNewGameButtons(host: MenuControlHost): void {
  [host.resetButton, host.newGameButton].forEach((button) => {
    button?.addEventListener('click', () => {
      host.startNewGame();
      button.blur();
    });
  });
}

function bindStarterButtons(host: MenuControlHost): void {
  host.starterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const starter = starterIdFrom(button.dataset.starter);
      if (host.isBattleActive() || !starter) return;
      host.setStarterId(starter);
      const party = [...host.getParty()];
      party[0] = host.createStarter(starter);
      host.setParty(party);
      host.onStarterSelected?.(starter);
      host.starterButtons.forEach((entry) => entry.classList.toggle('active', entry.dataset.starter === starter));
      host.persistSave();
      host.syncUi();
      button.blur();
    });
  });
}

function starterIdFrom(value: string | undefined): StarterId | null {
  return value === 'treecko' || value === 'torchic' || value === 'mudkip' ? value : null;
}

function bindSaveButton(host: MenuControlHost): void {
  host.saveButton?.addEventListener('click', () => {
    host.persistSave();
    if (!host.saveButton) return;
    setSaveButtonLabel(host.saveButton, 'Salvo!');
    host.window.setTimeout(() => {
      if (host.saveButton) setSaveButtonLabel(host.saveButton, 'Salvar');
    }, 1200);
    host.saveButton.blur();
  });
}

function setSaveButtonLabel(button: HTMLElement, label: string): void {
  const text = button.querySelector<HTMLElement>('.menu-label');
  if (text) {
    text.textContent = label;
    return;
  }
  button.textContent = label;
}

export function renderDsPanel(host: MenuHost): void {
  host.tabButtons.forEach((button) => renderMenuTabButton(button, host.getOpenTab()));
  const panel = host.panel;
  if (!panel) return;
  if (!host.getOpenTab() || host.getActiveBattle()) {
    panel.classList.remove('hoenn-map-open');
    panel.classList.remove('open');
    panel.innerHTML = '';
    return;
  }

  panel.classList.add('open');
  panel.innerHTML = '';
  panel.classList.remove('hoenn-map-open');
  const tab = host.getOpenTab();
  if (tab === 'party') {
    renderPartyTab(host, panel);
    return;
  }
  if (tab === 'bag') {
    renderBagTab(host, panel);
    return;
  }
  if (tab === 'time') {
    renderTimeTab(panel);
    return;
  }
  if (tab === 'map') {
    panel.classList.add('hoenn-map-open');
    renderHoennMapTab(host, panel);
    return;
  }
  panel.classList.remove('hoenn-map-open');
  renderPokedexTab(host.getPokedex(), panel);
}

function renderMenuTabButton(button: HTMLButtonElement, openTab: MenuTab | null): void {
  const tab = menuTabFrom(button.dataset.tab);
  if (!tab) return;
  const presentation = menuTabPresentation(tab);
  button.innerHTML = `<span class="menu-icon" aria-hidden="true">${presentation.icon}</span><span class="menu-label">${presentation.label}</span>`;
  button.setAttribute('aria-label', presentation.accessibleName);
  button.setAttribute('aria-pressed', String(tab === openTab));
  button.classList.toggle('active', tab === openTab);
}

function renderTimeTab(panel: HTMLElement): void {
  const now = new Date();
  const card = document.createElement('section');
  card.className = 'oras-time-card';
  const eyebrow = document.createElement('span');
  eyebrow.textContent = 'RELÓGIO DO 3DS';
  const time = document.createElement('time');
  time.className = 'oras-time-value';
  time.dateTime = now.toISOString();
  time.textContent = formatPlayNavTime(now);
  const date = document.createElement('span');
  date.className = 'oras-time-date';
  date.textContent = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  card.append(eyebrow, time, date);
  panel.appendChild(card);
}

function renderHoennMapTab(host: MenuHost, panel: HTMLElement): void {
  const playerMap = host.getPlayerMap();
  const playerLocation = resolveHoennLocation(playerMap.mapId, playerMap.zoneName);
  const selected = HOENN_LOCATIONS.find(({ id }) => id === host.getSelectedMapLocationId()) ?? playerLocation;
  const layout = document.createElement('div');
  layout.className = 'oras-hoenn-map';
  const svg = createHoennSvg(playerLocation, selected?.id ?? null, (id) => {
    const location = HOENN_LOCATIONS.find((entry) => entry.id === id);
    if (!location) return;
    host.setSelectedMapLocationId(id);
    updateMapSelection(svg, layout, location);
  });
  layout.append(svg, createMapDetails(selected ?? undefined));
  panel.appendChild(layout);
}

function createHoennSvg(
  playerLocation: (typeof HOENN_LOCATIONS)[number] | null,
  selectedId: string | null,
  selectLocation: (id: string) => void,
): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'hoenn-map-svg');
  svg.setAttribute('viewBox', `0 0 ${HOENN_MAP_VIEWBOX.width} ${HOENN_MAP_VIEWBOX.height}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa interativo da região de Hoenn');
  addMapBackdrop(svg);
  for (const [from, to] of HOENN_MAP_CONNECTIONS) addMapConnection(svg, from, to);
  for (const location of HOENN_LOCATIONS) addMapLocation(svg, location, selectedId, selectLocation);
  if (playerLocation) addPlayerMarker(svg, playerLocation);
  return svg;
}

function addMapBackdrop(svg: SVGSVGElement): void {
  const land = document.createElementNS(svg.namespaceURI, 'path');
  land.setAttribute('class', 'hoenn-map-land');
  land.setAttribute('d', 'M178 72 261 50 352 67 406 89 451 119 470 169 530 194 589 177 641 194 718 177 772 204 757 256 786 305 760 358 727 391 690 427 621 448 552 444 500 426 440 448 380 446 321 428 265 443 218 415 181 369 202 323 219 277 247 226 230 177 181 128Z');
  svg.appendChild(land);
}

function addMapConnection(svg: SVGSVGElement, fromId: string, toId: string): void {
  const from = HOENN_LOCATIONS.find(({ id }) => id === fromId);
  const to = HOENN_LOCATIONS.find(({ id }) => id === toId);
  if (!from || !to) return;
  const line = document.createElementNS(svg.namespaceURI, 'line');
  line.setAttribute('class', `hoenn-map-route${from.kind === 'route' || to.kind === 'route' ? ' road' : ''}`);
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
  svg.appendChild(line);
}

function addMapLocation(
  svg: SVGSVGElement,
  location: (typeof HOENN_LOCATIONS)[number],
  selectedId: string | null,
  selectLocation: (id: string) => void,
): void {
  const group = document.createElementNS(svg.namespaceURI, 'g');
  group.setAttribute('class', `hoenn-map-location ${location.kind}${location.id === selectedId ? ' selected' : ''}`);
  group.setAttribute('data-location-id', location.id);
  group.setAttribute('role', 'button');
  group.setAttribute('tabindex', '0');
  group.setAttribute('aria-label', `${location.name}. ${location.description}`);
  group.setAttribute('aria-pressed', String(location.id === selectedId));
  const title = document.createElementNS(svg.namespaceURI, 'title');
  title.textContent = `${location.name}: ${location.description}`;
  group.appendChild(title);
  const dot = document.createElementNS(svg.namespaceURI, 'circle');
  dot.setAttribute('r', location.kind === 'route' ? '5' : '8');
  group.appendChild(dot);
  if (shouldShowMapLabel(location, selectedId)) addMapLabel(group, location);
  group.addEventListener('click', () => selectLocation(location.id));
  group.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent) activateMapLocation(event, location.id, selectLocation);
  });
  group.setAttribute('transform', `translate(${location.x} ${location.y})`);
  svg.appendChild(group);
}

function shouldShowMapLabel(location: (typeof HOENN_LOCATIONS)[number], selectedId: string | null): boolean {
  return location.kind === 'city' || location.kind === 'town' || location.id === 'pokemon-league' || location.id === selectedId;
}

function addMapLabel(group: Element, location: (typeof HOENN_LOCATIONS)[number]): void {
  const label = document.createElementNS(group.namespaceURI, 'text');
  const offset = mapLabelOffset(location);
  label.setAttribute('x', String(offset.x));
  label.setAttribute('y', String(offset.y));
  if (offset.anchor) label.setAttribute('text-anchor', offset.anchor);
  label.textContent = location.kind === 'route' && location.id !== 'pokemon-league'
    ? location.name.replace('Route ', '')
    : location.name;
  group.appendChild(label);
}

function mapLabelOffset(location: (typeof HOENN_LOCATIONS)[number]): { x: number; y: number; anchor?: string } {
  if (location.id === 'verdanturf-town') return { x: -10, y: -12, anchor: 'end' };
  if (location.id === 'mauville-city') return { x: 10, y: 18 };
  if (location.id === 'oldale-town') return { x: -8, y: -12, anchor: 'end' };
  if (location.id === 'slateport-city') return { x: 10, y: 20 };
  if (location.id === 'littleroot-town') return { x: -10, y: 20, anchor: 'end' };
  if (location.id === 'ever-grande-city') return { x: -12, y: 15, anchor: 'end' };
  if (location.id === 'pokemon-league') return { x: -12, y: -8, anchor: 'end' };
  return location.x > 620 ? { x: -10, y: 4, anchor: 'end' } : { x: 10, y: 4 };
}

function activateMapLocation(event: KeyboardEvent, id: string, selectLocation: (id: string) => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  selectLocation(id);
}

function addPlayerMarker(svg: SVGSVGElement, location: (typeof HOENN_LOCATIONS)[number]): void {
  const marker = document.createElementNS(svg.namespaceURI, 'g');
  marker.setAttribute('class', 'hoenn-player-marker');
  marker.setAttribute('transform', `translate(${location.x} ${location.y})`);
  marker.setAttribute('aria-label', `Sua posição: ${location.name}`);
  const ring = document.createElementNS(svg.namespaceURI, 'circle');
  ring.setAttribute('r', '13');
  const label = document.createElementNS(svg.namespaceURI, 'text');
  label.setAttribute('x', '13');
  label.setAttribute('y', '-11');
  label.textContent = 'Você';
  marker.append(ring, label);
  svg.appendChild(marker);
}

function createMapDetails(location: (typeof HOENN_LOCATIONS)[number] | undefined): HTMLElement {
  const details = document.createElement('section');
  details.className = 'hoenn-map-details';
  updateMapDetails(details, location);
  return details;
}

function updateMapSelection(svg: SVGSVGElement, layout: HTMLElement, location: (typeof HOENN_LOCATIONS)[number]): void {
  svg.querySelectorAll<SVGGElement>('.hoenn-map-location').forEach((marker) => {
    const selected = marker.dataset.locationId === location.id;
    marker.classList.toggle('selected', selected);
    marker.setAttribute('aria-pressed', String(selected));
  });
  const details = layout.querySelector<HTMLElement>('.hoenn-map-details');
  if (details) updateMapDetails(details, location);
}

function updateMapDetails(details: HTMLElement, location: (typeof HOENN_LOCATIONS)[number] | undefined): void {
  details.replaceChildren();
  const name = document.createElement('strong');
  name.textContent = location?.name ?? 'Posição atual';
  const description = document.createElement('span');
  description.textContent = location?.description ?? 'Esta zona ainda não está associada a um ponto do mapa de Hoenn.';
  details.append(name, description);
}

function renderPartyTab(host: MenuHost, panel: HTMLElement): void {
  const grid = document.createElement('div');
  grid.className = 'oras-party-grid';
  for (let index = 0; index < 6; index++) {
    const member = host.getParty()[index];
    const card = document.createElement('div');
    card.className = `oras-party-card${index === 0 ? ' lead' : ''}`;
    if (!member) {
      card.innerHTML = `<div style="color:#64748b">Slot ${index + 1} — Vazio</div>`;
      grid.appendChild(card);
      continue;
    }
    addPartyMember(host, card, member, index);
    grid.appendChild(card);
  }
  panel.appendChild(grid);
}

function addPartyMember(host: MenuHost, card: HTMLElement, member: PokemonInstance, index: number): void {
  const xpPct = member.nextLevelXp > 0 ? Math.min(100, Math.round((member.xp / member.nextLevelXp) * 100)) : 0;
  const info = document.createElement('div');
  info.innerHTML = `<div><strong>${member.species.name}</strong> <span style="color:#93c5fd">Lv.${member.level}</span></div>
        <div style="font-size:11px;color:#cbd5e1">${member.currentHp}/${member.maxHp} HP · ${member.species.types.join('/')}</div>
        ${createHpBarMarkup(member.currentHp, member.maxHp)}
        <div style="font-size:10px;color:#60a5fa;margin-top:2px">EXP ${xpPct}%</div>`;
  card.appendChild(info);
  if (member.currentHp >= member.maxHp || host.getBag().potions <= 0) return;
  const healButton = document.createElement('button');
  healButton.textContent = 'Usar Potion';
  healButton.onclick = () => healPartyMember(host, member, index);
  card.appendChild(healButton);
}

function healPartyMember(host: MenuHost, member: PokemonInstance, index: number): void {
  const result = usePotion(host.getBag(), member);
  if (!result.used) return;
  host.setBag(result.bag);
  const party = [...host.getParty()];
  party[index] = result.pokemon;
  host.setParty(party);
  host.renderIntro();
  host.syncUi();
}

function renderBagTab(host: MenuHost, panel: HTMLElement): void {
  const pocketBar = document.createElement('div');
  pocketBar.className = 'oras-bag-tabs';
  const pockets: Array<{ id: BagPocket; label: string }> = [
    { id: 'items', label: 'Itens' },
    { id: 'balls', label: 'Poké Balls' },
    { id: 'key', label: 'Itens-Chave' },
  ];
  for (const pocket of pockets) {
    const button = document.createElement('button');
    button.textContent = pocket.label;
    if (host.getActiveBagPocket() === pocket.id) button.classList.add('active');
    button.onclick = () => {
      host.setActiveBagPocket(pocket.id);
      renderDsPanel(host);
    };
    pocketBar.appendChild(button);
  }
  panel.appendChild(pocketBar);
  bagPocketItems(host.getBag(), host.getActiveBagPocket()).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'ds-item';
    row.innerHTML = `<div><strong>${item.label}</strong><div style="color:#94a3b8">${item.desc}</div></div><span>x${item.count}</span>`;
    panel.appendChild(row);
  });
}
