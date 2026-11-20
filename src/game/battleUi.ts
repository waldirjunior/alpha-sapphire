import { consumePokeball, usePotion, type BagState } from '../core/bag';
import {
  createPokemonInstance,
  executeBattleTurn,
  resolvePendingMove,
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
import { recordCaughtSpecies, recordEvolution, type PokedexState } from '../core/pokedex';
import { classifyBattleMusic, JINGLES, leveledUpDuring, type BattleMusicKind, type SfxCue } from '../core/battleAudio';
import { SPECIES } from '../data/pokemon/species';
import type { BattleEvent } from '../core/battleEvents';
import { evolveAfterBattleWithPrompt, getPendingMovePrompt } from './battleProgression';

export interface BattleUiHost {
  overlay: HTMLElement | null;
  enemy: HTMLElement | null;
  player: HTMLElement | null;
  log: HTMLElement | null;
  actions: HTMLElement | null;
  prompt: HTMLElement | null;
  promptTitle: HTMLElement | null;
  promptMessage: HTMLElement | null;
  promptActions: HTMLElement | null;
  scene: {
    syncBattle(battle: BattleState | null): void;
    playAttackEffect(type: BattleMove['type']): void;
    playBattleEvents(events: readonly BattleEvent[], enemyMoveType: BattleMove['type']): Promise<void>;
    playPokeballEffect(captured?: boolean): void;
    playSfx(cue: SfxCue): void;
  };
  getBattle(): BattleState | null;
  setBattle(battle: BattleState | null): void;
  isAnimating(): boolean;
  setAnimating(value: boolean): void;
  getParty(): PokemonInstance[];
  setParty(party: PokemonInstance[]): void;
  getPokedex(): PokedexState;
  setPokedex(pokedex: PokedexState): void;
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

export function countCaughtSpecies(pokedex: PokedexState): number {
  return pokedex.caughtSpecies.length;
}

export function resolveBattleMusicContext(battle: BattleState | null): BattleMusicKind | null {
  return battle ? classifyBattleMusic(battle) : null;
}

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
    hideBattlePrompt(host);
    overlay.classList.remove('open');
    return;
  }

  overlay.classList.add('open');
  renderBattleSummary(battle, enemy, player, log, actions);
  const pendingPrompt = getPendingMovePrompt(battle);
  if (pendingPrompt) {
    showPendingMovePrompt(host, battle, pendingPrompt);
    return;
  }
  hideBattlePrompt(host);
  if (battle.status === 'ongoing') {
    renderOngoingBattle(host, battle, actions);
    return;
  }
  renderFinishedBattle(host, actions);
}

function showPendingMovePrompt(
  host: BattleUiHost,
  battle: BattleState,
  pending: NonNullable<ReturnType<typeof getPendingMovePrompt>>
): void {
  const choices: { label: string; value: number | null }[] = pending.choices.map(({ slot, moveName }) => ({
    label: `Esquecer ${moveName}`,
    value: slot,
  }));
  choices.push({ label: pending.skipLabel, value: null });
  void showBattlePrompt(
    host,
    `${pending.pokemonName} quer aprender ${pending.moveName}`,
    'Qual golpe deve esquecer?',
    choices
  ).then((slot) => {
    if (host.getBattle() !== battle) return;
    host.setBattle(resolvePendingMove(battle, slot));
    syncPartyFromBattle(host);
    renderBattle(host);
  });
}

function showBattlePrompt<T>(
  host: BattleUiHost,
  title: string,
  message: string,
  choices: { label: string; value: T }[]
): Promise<T> {
  const fallback = choices[choices.length - 1];
  const { prompt, promptTitle, promptMessage, promptActions } = host;
  if (!prompt || !promptTitle || !promptMessage || !promptActions) {
    return fallback ? Promise.resolve(fallback.value) : Promise.reject(new Error('Prompt de batalha sem opções.'));
  }
  promptTitle.textContent = title;
  promptMessage.textContent = message;
  promptActions.replaceChildren();
  prompt.hidden = false;
  return new Promise((resolve) => {
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.label;
      button.onclick = () => {
        prompt.hidden = true;
        resolve(choice.value);
      };
      promptActions.appendChild(button);
    }
  });
}

function hideBattlePrompt(host: BattleUiHost): void {
  if (host.prompt) host.prompt.hidden = true;
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
    host.scene.playSfx('heal-chime');
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
  const next = throwPokeball(battle, Math.random, countCaughtSpecies(host.getPokedex()));
  host.scene.playPokeballEffect(next.status === 'caught');
  host.setBattle(next);
  syncPartyFromBattle(host);
  if (next.status === 'caught') {
    host.incrementCaughtCount();
    host.setPokedex(recordCaughtSpecies(host.getPokedex(), next.enemy.species.id));
    const party = host.getParty();
    if (party.length < 6) host.setParty([...party, next.enemy]);
  }
  renderBattle(host);
}

function renderFinishedBattle(host: BattleUiHost, actions: HTMLElement): void {
  const button = document.createElement('button');
  button.textContent = 'Voltar ao mapa';
  button.onclick = () => { void closeBattle(host); };
  actions.appendChild(button);
}

async function closeBattle(host: BattleUiHost): Promise<void> {
  const battle = host.getBattle();
  if (battle?.isTrainer && battle.status === 'victory' && host.getActiveTrainerId()) {
    const state = host.getState();
    host.setState({
      ...state,
      storyFlags: { ...state.storyFlags, [`defeated_trainer:${host.getActiveTrainerId()}`]: true },
    });
  }
  if (battle && battle.status !== 'defeat') {
    const previousParty = host.getParty();
    const evolved = await evolveAfterBattleWithPrompt(
      previousParty,
      battle.leveledUp,
      timeOfDayFromHour(new Date().getHours()),
      async (pokemon, target) => showBattlePrompt(
        host,
        `${pokemon.species.name} quer evoluir para ${target.species.name}`,
        'Deseja evoluir? Você pode cancelar agora.',
        [
          { label: 'Evoluir', value: true },
          { label: 'Cancelar', value: false },
        ]
      )
    );
    recordPartyEvolutions(host, previousParty, evolved);
    host.setParty(evolved);
  }
  hideBattlePrompt(host);
  if (battle?.status === 'defeat') resetAfterDefeat(host);
  host.setBattle(null);
  host.setActiveTrainerId(null);
  host.persistSave();
  renderBattle(host);
  host.renderIntro();
  host.syncUi();
  host.onClose?.(battle);
}

function recordPartyEvolutions(
  host: BattleUiHost,
  previousParty: readonly PokemonInstance[],
  evolvedParty: readonly PokemonInstance[],
): void {
  evolvedParty.forEach((pokemon, index) => {
    if (previousParty[index]?.species.id === pokemon.species.id) return;
    host.setPokedex(recordEvolution(host.getPokedex(), pokemon.species.id));
  });
}

function resetAfterDefeat(host: BattleUiHost): void {
  const party = [...host.getParty()];
  party[0] = createPokemonInstance(SPECIES[host.getStarterId()], 5);
  host.setParty(party);
  host.setState(createInitialState(host.startMapId, host.maps));
}
