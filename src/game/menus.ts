import type { BagState } from '../core/bag';
import { useBagEvolutionItem, usePotion } from '../core/bag';
import type { BattleState, PendingMoveLearn, PokemonInstance } from '../core/battle';
import { findItemEvolution } from '../core/evolution';
import { recordCaughtSpecies, type PokedexState } from '../core/pokedex';
import { createHpBarMarkup } from './battleUi';
import { bindAudioControls, type AudioControlsHost } from './audioControls';
import { renderAreaNavTab } from './areaNav';
import { renderPokedexTab } from './pokedexMenu';
export { pokedexCounts, pokedexEntries, pokedexSpeciesStatus } from './pokedexMenu';

export type MenuTab = 'party' | 'bag' | 'pokedex' | 'time' | 'map';
export type BagPocket = 'items' | 'balls' | 'key';
export interface BagPocketItem {
  label: string;
  count: number;
  desc: string;
}

export interface EvolutionItemPartyOption {
  index: number;
  pokemonName: string;
  targetSpeciesName: string;
  eligible: true;
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
  if (pocket === 'items') return [
    { label: 'Potion', count: bag.potions, desc: 'Restaura 20 HP de um Pokémon.' },
    ...Object.entries(bag.evolutionItems ?? {}).map(([label, count]) => ({
      label, count, desc: 'Evolui Pokémon compatíveis.',
    })),
  ];
  if (pocket === 'balls') return [{ label: 'Poké Ball', count: bag.pokeballs, desc: 'Captura Pokémon selvagens em batalha.' }];
  if (bag.keyItems.length) return bag.keyItems.map((label) => ({ label, count: 1, desc: 'Item-chave de aventura.' }));
  return [{ label: 'PokéNav Plus', count: 1, desc: 'Equipado na tela inferior do 3DS.' }];
}

export function evolutionItemPartyOptions(
  party: readonly PokemonInstance[],
  itemName: string
): EvolutionItemPartyOption[] {
  return party.flatMap((pokemon, index) => {
    const target = findItemEvolution(pokemon, itemName);
    return target ? [{
      index,
      pokemonName: pokemon.species.name,
      targetSpeciesName: target.name,
      eligible: true as const,
    }] : [];
  });
}

export function applyEvolutionItemFromMenu(
  host: EvolutionItemMenuHost,
  itemName: string,
  partyIndex: number
): boolean {
  if (host.getActiveBattle()) return false;
  const pokemon = host.getParty()[partyIndex];
  if (!pokemon) return false;
  const result = useBagEvolutionItem(host.getBag(), pokemon, itemName);
  if (!result.used) return false;

  const party = [...host.getParty()];
  party[partyIndex] = result.pokemon;
  host.setBag(result.bag);
  host.setParty(party);
  host.setPokedex(recordCaughtSpecies(host.getPokedex(), result.pokemon.species.id));
  host.setPendingMoves([
    ...host.getPendingMoves(),
    ...result.pendingMoves.map(moveId => ({ partyIndex, moveId })),
  ]);
  host.persistSave();
  host.renderIntro();
  host.syncUi();
  return true;
}

export interface EvolutionItemMenuHost {
  getActiveBattle(): BattleState | null;
  getParty(): PokemonInstance[];
  setParty(party: PokemonInstance[]): void;
  getPokedex(): PokedexState;
  setPokedex(pokedex: PokedexState): void;
  getBag(): BagState;
  setBag(bag: BagState): void;
  getPendingMoves(): PendingMoveLearn[];
  setPendingMoves(moves: PendingMoveLearn[]): void;
  persistSave(): void;
  renderIntro(): void;
  syncUi(): void;
}

export interface MenuHost extends EvolutionItemMenuHost {
  panel: HTMLElement | null;
  tabButtons: NodeListOf<HTMLButtonElement>;
  getOpenTab(): MenuTab | null;
  setOpenTab(tab: MenuTab | null): void;
  getActiveBagPocket(): BagPocket;
  setActiveBagPocket(pocket: BagPocket): void;
  getPlayerMap(): { mapId: string; zoneName?: string };
  getSelectedMapLocationId(): string | null;
  setSelectedMapLocationId(locationId: string): void;
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
    renderAreaNavTab(host, panel);
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
    if (item.count > 0 && Object.prototype.hasOwnProperty.call(host.getBag().evolutionItems ?? {}, item.label)) {
      const useButton = document.createElement('button');
      useButton.textContent = 'Usar';
      useButton.onclick = () => renderEvolutionItemPartySelector(host, panel, item.label);
      row.appendChild(useButton);
    }
    panel.appendChild(row);
  });
}

function renderEvolutionItemPartySelector(host: MenuHost, panel: HTMLElement, itemName: string): void {
  panel.replaceChildren();
  const selector = document.createElement('section');
  selector.className = 'oras-evolution-item-selector';
  const title = document.createElement('strong');
  title.textContent = `Usar ${itemName} em:`;
  selector.appendChild(title);

  const options = evolutionItemPartyOptions(host.getParty(), itemName);
  if (options.length === 0) {
    const message = document.createElement('p');
    message.textContent = 'Nenhum Pokémon da equipe pode evoluir com este item.';
    selector.appendChild(message);
  }
  for (const option of options) {
    const button = document.createElement('button');
    button.textContent = `${option.pokemonName} → ${option.targetSpeciesName}`;
    button.onclick = () => {
      if (applyEvolutionItemFromMenu(host, itemName, option.index)) renderDsPanel(host);
    };
    selector.appendChild(button);
  }

  const cancel = document.createElement('button');
  cancel.textContent = 'Voltar à mochila';
  cancel.onclick = () => renderDsPanel(host);
  selector.appendChild(cancel);
  panel.appendChild(selector);
}
