import { consumePokeball, usePotion, type BagState } from '../core/bag';
import {
  createPokemonInstance,
  evolveAfterBattle,
  executeBattleTurn,
  runFromBattle,
  switchActivePokemon,
  throwPokeball,
  timeOfDayFromHour,
  updateActivePlayer,
  type BattleMove,
  type BattleState,
  type PokemonInstance,
} from '../core/battle';
import { createInitialState } from '../core/gameState';
import type { GameState, MapDefinition } from '../core/types';
import { JINGLES, leveledUpDuring } from '../core/battleAudio';
import { SPECIES } from '../data/pokemon/species';
import type { BattleEvent } from '../core/battleEvents';

export interface BattleUiHost {
  overlay: HTMLElement | null;
  enemy: HTMLElement | null;
  player: HTMLElement | null;
  log: HTMLElement | null;
  actions: HTMLElement | null;
  scene: {
    syncBattle(battle: BattleState | null): void;
    playAttackEffect(type: BattleMove['type']): void;
    playBattleEvents(events: readonly BattleEvent[], enemyMoveType: BattleMove['type']): Promise<void>;
    playPokeballEffect(): void;
  };
  getBattle(): BattleState | null;
  setBattle(battle: BattleState | null): void;
  isAnimating(): boolean;
  setAnimating(value: boolean): void;
  getParty(): PokemonInstance[];
  setParty(party: PokemonInstance[]): void;
  getActivePartyIndex(): number;
  setActivePartyIndex(index: number): void;
  getActiveTrainerId(): string | null;
  setActiveTrainerId(id: string | null): void;
  getBag(): BagState;
  setBag(bag: BagState): void;
  incrementCaughtCount(): void;
  getState(): GameState;
  setState(state: GameState): void;
  getStarterId(): 'treecko' | 'torchic' | 'mudkip';
  onClose?(battle: BattleState | null): void;
  startMapId: string;
  maps: Record<string, MapDefinition>;
  playJingle(name: string): void;
  syncMusic(): void;
  renderIntro(): void;
  syncUi(): void;
  persistSave(): void;
}

export type BattlePartyHost = Pick<BattleUiHost,
  'getBattle' | 'getParty' | 'setParty' | 'setActivePartyIndex' | 'playJingle'>;

export function createHpBarMarkup(currentHp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
  const pct = Math.round(ratio * 100);
  const color = ratio > 0.5 ? '#22c55e' : ratio > 0.2 ? '#eab308' : '#ef4444';
  return `<div class="hp-bar-track"><div class="hp-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

export function createBattleCombatantMarkup(label: string, pokemon: PokemonInstance): string {
  const safeLabel = escapeBattleMarkup(label);
  const safeName = escapeBattleMarkup(pokemon.species.name);
  return `<div class="battle-combatant-heading"><span class="battle-combatant-label">${safeLabel}</span><strong>${safeName}</strong><span class="battle-level">Lv.${pokemon.level}</span></div><div class="battle-hp-value">${pokemon.currentHp}/${pokemon.maxHp} HP</div>${createHpBarMarkup(pokemon.currentHp, pokemon.maxHp)}`;
}

function escapeBattleMarkup(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/gu, (character) => entities[character] ?? character);
}

export function syncPartyFromBattle(host: BattlePartyHost): void {
  const battle = host.getBattle();
  if (!battle) return;
  if (leveledUpDuring(host.getParty(), battle.playerParty)) host.playJingle(JINGLES.levelUp);
  host.setParty([...battle.playerParty]);
  host.setActivePartyIndex(battle.playerActive);
}

export function renderBattle(host: BattleUiHost): void {
  const battle = host.getBattle();
  host.scene.syncBattle(battle);
  host.syncMusic();
  const { overlay, enemy, player, log, actions } = host;
  if (!overlay || !enemy || !player || !log || !actions) return;
  actions.inert = host.isAnimating();
  if (!battle) {
    overlay.classList.remove('open');
    return;
  }

  overlay.classList.add('open');
  renderBattleSummary(battle, enemy, player, log, actions);
  if (battle.status === 'ongoing') {
    renderOngoingBattle(host, battle, actions);
    return;
  }
  renderFinishedBattle(host, actions);
}

function renderBattleSummary(
  battle: BattleState,
  enemy: HTMLElement,
  player: HTMLElement,
  log: HTMLElement,
  actions: HTMLElement
): void {
  const prefix = battle.isTrainer && battle.trainerName ? `${battle.trainerName}: ` : 'Selvagem: ';
  enemy.innerHTML = createBattleCombatantMarkup(prefix, battle.enemy);
  player.innerHTML = createBattleCombatantMarkup('Seu Pokémon', battle.player);
  log.innerHTML = battle.log.slice(-4).map((line) => `<div>${line}</div>`).join('');
  actions.innerHTML = '';
}

function renderOngoingBattle(host: BattleUiHost, battle: BattleState, actions: HTMLElement): void {
  battle.player.moves.forEach((move, idx) => addMoveButton(host, battle, move, idx, actions));
  host.getParty().forEach((member, idx) => addSwitchButton(host, member, idx, actions));
  addPotionButton(host, battle, actions);
  if (!battle.isTrainer) addWildBattleButtons(host, actions);
}

function addMoveButton(host: BattleUiHost, battle: BattleState, move: BattleMove, index: number, actions: HTMLElement): void {
  const button = document.createElement('button');
  button.textContent = `${move.name} (${move.type}) ${move.currentPp}/${move.maxPp} PP`;
  button.disabled = move.currentPp === 0 && battle.player.moves.some((slot) => slot.currentPp > 0);
  button.onclick = async () => {
    const before = host.getBattle();
    if (!before || host.isAnimating()) return;
    const next = executeBattleTurn(before, index);
    host.setAnimating(true);
    actions.querySelectorAll('button').forEach((entry) => { entry.disabled = true; });
    host.scene.playAttackEffect(move.type);
    try {
      await host.scene.playBattleEvents(next.events ?? [], before.enemy.moves[0]?.type ?? 'normal');
      if (host.getBattle() === before) host.setBattle(next);
    } finally {
      host.setAnimating(false);
      syncPartyFromBattle(host);
      renderBattle(host);
    }
  };
  actions.appendChild(button);
}

function addSwitchButton(host: BattleUiHost, member: PokemonInstance, index: number, actions: HTMLElement): void {
  if (index === host.getActivePartyIndex() || member.currentHp <= 0) return;
  const button = document.createElement('button');
  button.textContent = `Trocar: ${member.species.name} (${member.currentHp}/${member.maxHp})`;
  button.onclick = () => {
    const battle = host.getBattle();
    if (!battle) return;
    host.setBattle(switchActivePokemon(battle, index));
    syncPartyFromBattle(host);
    renderBattle(host);
  };
  actions.appendChild(button);
}

function addPotionButton(host: BattleUiHost, battle: BattleState, actions: HTMLElement): void {
  const bag = host.getBag();
  const button = document.createElement('button');
  button.textContent = `Potion (${bag.potions})`;
  button.disabled = bag.potions <= 0 || battle.player.currentHp >= battle.player.maxHp;
  button.onclick = () => {
    const current = host.getBattle();
    if (!current) return;
    const result = usePotion(host.getBag(), current.player);
    if (!result.used) return;
    host.setBag(result.bag);
    host.setBattle({
      ...updateActivePlayer(current, result.pokemon),
      log: [...current.log, `Potion usada em ${result.pokemon.species.name} (${result.pokemon.currentHp}/${result.pokemon.maxHp} HP).`],
    });
    syncPartyFromBattle(host);
    renderBattle(host);
  };
  actions.appendChild(button);
}

function addWildBattleButtons(host: BattleUiHost, actions: HTMLElement): void {
  const ballButton = document.createElement('button');
  ballButton.textContent = `Poké Ball (${host.getBag().pokeballs})`;
  ballButton.disabled = host.getBag().pokeballs <= 0;
  ballButton.onclick = () => throwWildBall(host);
  actions.appendChild(ballButton);

  const runButton = document.createElement('button');
  runButton.textContent = 'Fugir';
  runButton.onclick = () => {
    const battle = host.getBattle();
    if (!battle) return;
    host.setBattle(runFromBattle(battle));
    renderBattle(host);
  };
  actions.appendChild(runButton);
}

function throwWildBall(host: BattleUiHost): void {
  const battle = host.getBattle();
  if (!battle) return;
  const consumed = consumePokeball(host.getBag());
  if (!consumed.ok) return;
  host.setBag(consumed.bag);
  host.scene.playPokeballEffect();
  const next = throwPokeball(battle);
  host.setBattle(next);
  syncPartyFromBattle(host);
  if (next.status === 'caught') {
    host.incrementCaughtCount();
    const party = host.getParty();
    if (party.length < 6) host.setParty([...party, next.enemy]);
  }
  renderBattle(host);
}

function renderFinishedBattle(host: BattleUiHost, actions: HTMLElement): void {
  const button = document.createElement('button');
  button.textContent = 'Voltar ao mapa';
  button.onclick = () => closeBattle(host);
  actions.appendChild(button);
}

function closeBattle(host: BattleUiHost): void {
  const battle = host.getBattle();
  if (battle?.isTrainer && battle.status === 'victory' && host.getActiveTrainerId()) {
    const state = host.getState();
    host.setState({
      ...state,
      storyFlags: { ...state.storyFlags, [`defeated_trainer:${host.getActiveTrainerId()}`]: true },
    });
  }
  if (battle && battle.status !== 'defeat') {
    const evolved = evolveAfterBattle(host.getParty(), battle.leveledUp, timeOfDayFromHour(new Date().getHours())).party;
    host.setParty(evolved);
  }
  if (battle?.status === 'defeat') resetAfterDefeat(host);
  host.setBattle(null);
  host.setActiveTrainerId(null);
  host.persistSave();
  renderBattle(host);
  host.renderIntro();
  host.syncUi();
  host.onClose?.(battle);
}

function resetAfterDefeat(host: BattleUiHost): void {
  const party = [...host.getParty()];
  party[0] = createPokemonInstance(SPECIES[host.getStarterId()], 5);
  host.setParty(party);
  host.setState(createInitialState(host.startMapId, host.maps));
}
