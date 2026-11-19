import type { BagState } from '../core/bag';
import { usePotion } from '../core/bag';
import type { BattleState, PokemonInstance } from '../core/battle';
import { SPECIES } from '../data/pokemon/species';
import { createHpBarMarkup } from './battleUi';

export type MenuTab = 'party' | 'bag' | 'pokedex';
export type BagPocket = 'items' | 'balls' | 'key';
export interface BagPocketItem {
  label: string;
  count: number;
  desc: string;
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
  getBag(): BagState;
  setBag(bag: BagState): void;
  setParty(party: PokemonInstance[]): void;
  getActiveBagPocket(): BagPocket;
  setActiveBagPocket(pocket: BagPocket): void;
  renderIntro(): void;
  syncUi(): void;
}

export type StarterId = 'treecko' | 'torchic' | 'mudkip';

export interface MenuControlHost {
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

function menuTabFrom(value: string | undefined): MenuTab | null {
  return value === 'party' || value === 'bag' || value === 'pokedex' ? value : null;
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
    host.saveButton.textContent = 'Salvo!';
    host.window.setTimeout(() => {
      if (host.saveButton) host.saveButton.textContent = 'Salvar';
    }, 1200);
    host.saveButton.blur();
  });
}

export function renderDsPanel(host: MenuHost): void {
  host.tabButtons.forEach((button) =>
    button.classList.toggle('active', button.dataset.tab === host.getOpenTab())
  );
  const panel = host.panel;
  if (!panel) return;
  if (!host.getOpenTab() || host.getActiveBattle()) {
    panel.classList.remove('open');
    panel.innerHTML = '';
    return;
  }

  panel.classList.add('open');
  panel.innerHTML = '';
  const tab = host.getOpenTab();
  if (tab === 'party') {
    renderPartyTab(host, panel);
    return;
  }
  if (tab === 'bag') {
    renderBagTab(host, panel);
    return;
  }
  renderPokedexTab(host.getParty(), panel);
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

function renderPokedexTab(party: PokemonInstance[], panel: HTMLElement): void {
  const grid = document.createElement('div');
  grid.className = 'oras-dex-grid';
  const ownedIds = new Set(party.map((pokemon) => pokemon.species.id));
  for (const species of Object.values(SPECIES)) {
    const hasIt = ownedIds.has(species.id);
    const cell = document.createElement('div');
    cell.className = `ds-item${hasIt ? ' caught' : ''}`;
    cell.innerHTML = `<div><strong>#${species.dexNumber} ${species.name}</strong><div style="color:#94a3b8">${species.types.join('/')}</div></div><span>${hasIt ? 'Registrado' : '---'}</span>`;
    grid.appendChild(cell);
  }
  panel.appendChild(grid);
}
