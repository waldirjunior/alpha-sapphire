import type { Direction } from '../core/types';
import { addBagItem } from '../core/bag';
import {
  encounterMethodForTile,
  encounterTableFromZone,
  generatePokemon,
  resolveEncounterTableForMethod,
  rollHordeEncounter,
  type EncounterMethod,
  type ZoneEncounterSources,
  type ZoneEncounterSource,
} from '../core/wildPokemon';
import {
  healParty,
  rollWildEncounter,
  startTrainerBattle,
  startWildBattle,
  type BattleState,
  type PokemonInstance,
} from '../core/battle';
import {
  findTriggeredTrainer,
  interact,
} from '../core/gameState';
import type { BagState } from '../core/bag';
import type { GameState, MapDefinition } from '../core/types';
import { stepPosition, stepWarp } from '../core/warps';
import { MAP_ENCOUNTERS } from '../data/pokemon/route101';
import { findRosterSpecies } from '../data/pokemon/species';
import { facingNpc, mapEntryReason } from '../engine/eventHost';
import { transitionMap } from '../engine/mapTransition';
import { resolveNpcInteraction } from '../core/npcInteractions';
import { loadZoneTextLines } from '../engine/zoneTextBank';
import { resolveRosterSpeciesId } from '../engine/zoneEncounterLoader';
import type { ZoneEvents } from '../engine/zoneEvents';
import type { SfxCue } from '../core/battleAudio';
import { createWildBattlePokemon } from './wildBattle';

const KEY_TO_DIR: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

export function directionForKey(code: string): Direction | null {
  return KEY_TO_DIR[code] ?? null;
}

export function encounterMethodForInput(
  code: string,
  shiftKey = false,
  altKey = false
): EncounterMethod | null {
  if (code === 'KeyF') return altKey ? 'super_rod' : shiftKey ? 'good_rod' : 'old_rod';
  if (code === 'KeyR') return 'rock_smash';
  if (code === 'KeyH') return 'horde_a';
  if (code === 'KeyU') return 'surf';
  if (code === 'KeyT') return 'tall_grass';
  return null;
}

export function hasSurfEncounterAccess(
  map: MapDefinition,
  player: Pick<GameState['player'], 'pos' | 'facing'>
): boolean {
  return encounterMethodForTile(map, player.pos) === 'surf' ||
    encounterMethodForTile(map, stepPosition(player.pos, player.facing)) === 'surf';
}

type InputZoneEvents = Pick<ZoneEvents, 'busy' | 'interactionActive' | 'canAdvance' | 'advance' | 'interact' | 'enter'>;

export interface EncounterInputHost {
  maps: Record<string, MapDefinition>;
  getEncounterSources(): Record<string, ZoneEncounterSource>;
  getState(): GameState;
  getBattle(): BattleState | null;
  setBattle(battle: BattleState): void;
  getParty(): PokemonInstance[];
  syncPartyFromBattle(): void;
  renderBattle(): void;
}

export interface GameInputHost extends EncounterInputHost {
  app: HTMLElement;
  hudPosition: HTMLElement | null;
  zoneEvents: InputZoneEvents;
  move(state: GameState, direction: Direction): Promise<GameState>;
  setState(state: GameState): void;
  getIntroStep(): 'birch' | 'truck' | null;
  getMoving(): boolean;
  setMoving(value: boolean): void;
  setParty(party: PokemonInstance[]): void;
  getBag(): BagState;
  setBag(bag: BagState): void;
  setActiveTrainerId(id: string): void;
  renderIntro(): void;
  syncUi(): void;
  playSfx(cue: SfxCue): void;
}

export function triggerEncounterForMethod(host: EncounterInputHost, method: EncounterMethod): void {
  startWildEncounter(host, method);
}

export function bindGameInput(target: Window, host: GameInputHost): void {
  target.addEventListener('keydown', async (event) => handleGameKeyDown(event, host));
}

async function handleGameKeyDown(event: KeyboardEvent, host: GameInputHost): Promise<void> {
  if (host.getBattle() || host.getIntroStep() || host.getMoving()) return;
  if (event.code === 'Space' || event.code === 'Enter') {
    await handleInteractionKey(event, host);
    return;
  }
  const encounterMethod = encounterMethodForInput(event.code, event.shiftKey, event.altKey);
  if (encounterMethod) {
    event.preventDefault();
    startWildEncounter(host, encounterMethod);
    return;
  }
  const direction = directionForKey(event.code);
  if (!direction || host.zoneEvents.busy) return;
  await moveInDirection(event, direction, host);
}

async function handleInteractionKey(event: KeyboardEvent, host: GameInputHost): Promise<void> {
  event.preventDefault();
  if (host.zoneEvents.busy || host.zoneEvents.interactionActive) {
    if (host.zoneEvents.canAdvance) host.playSfx('dialogue-confirm');
    await host.zoneEvents.advance();
    return;
  }
  const state = host.getState();
  const npc = !state.activeDialogue && facingNpc(state.player, host.maps[state.player.mapId]);
  if (npc) {
    await interactWithNpc(npc, host);
    return;
  }
  if (host.zoneEvents.canAdvance) {
    host.playSfx('dialogue-confirm');
    await host.zoneEvents.advance();
    return;
  }
  if (host.getState().activeDialogue) host.playSfx('dialogue-confirm');
  interactWithMap(host);
}

async function interactWithNpc(npc: NonNullable<ReturnType<typeof facingNpc>>, host: GameInputHost): Promise<void> {
  if (await host.zoneEvents.interact(npc)) return;
  const state = host.getState();
  const lines = await loadZoneTextLines(host.maps[state.player.mapId]?.zoneId);
  const outcome = resolveNpcInteraction(npc, state.player.mapId, lines);
  if (outcome.healed) {
    host.setParty(healParty(host.getParty()));
    host.playSfx('heal-chime');
  }
  if (outcome.restockItems) {
    const bag = addBagItem(
      addBagItem(host.getBag(), 'potions', outcome.restockItems.potions),
      'pokeballs',
      outcome.restockItems.pokeballs
    );
    host.setBag(bag);
  }
  host.setState({ ...state, activeDialogue: { sourceId: npc.id, text: outcome.text } });
  host.syncUi();
}

function interactWithMap(host: GameInputHost): void {
  const before = host.getState();
  const wasDialogueOpen = Boolean(before.activeDialogue);
  const previousSourceId = before.activeDialogue?.sourceId;
  const hadLabGift = Boolean(before.storyFlags.visited_birch_lab);
  let state = interact(before, host.maps);
  const sourceId = state.activeDialogue?.sourceId;
  if (isHealingDialogue(sourceId)) {
    host.setParty(healParty(host.getParty()));
    host.playSfx('heal-chime');
  }
  if (!hadLabGift && state.storyFlags.visited_birch_lab) {
    const bag = addBagItem(addBagItem(host.getBag(), 'pokeballs', 5), 'potions', 2);
    host.setBag(bag);
  }
  host.setState(state);
  if (wasDialogueOpen && previousSourceId) state = maybeStartTrainerBattle(state, previousSourceId, host);
  host.setState(state);
  host.renderIntro();
  host.syncUi();
}

function isHealingDialogue(sourceId: string | undefined): boolean {
  return sourceId === 'oldale_pokecenter' || sourceId === 'nurse_joy_oldale' || sourceId === 'mom_heal_interior';
}

function maybeStartTrainerBattle(state: GameState, sourceId: string, host: GameInputHost): GameState {
  const trainerSource = host.maps[state.player.mapId]?.interactables?.find(
    (item) => item.id === sourceId && item.trainer
  );
  if (!trainerSource?.trainer || state.storyFlags[`defeated_trainer:${trainerSource.id}`]) return state;
  const trainer = trainerSource.trainer;
  const enemyTeam = (trainer.team ?? [trainer]).flatMap((member) => {
    const species = findRosterSpecies(member.speciesId);
    return species ? [generatePokemon(species, member.level, Math.random)] : [];
  });
  if (!host.getParty().some((pokemon) => pokemon.currentHp > 0) || enemyTeam.length === 0) return state;
  host.setActiveTrainerId(trainerSource.id);
  host.setBattle(startTrainerBattle(host.getParty(), enemyTeam, trainer.name));
  host.syncPartyFromBattle();
  host.renderBattle();
  return state;
}

async function moveInDirection(event: KeyboardEvent, direction: Direction, host: GameInputHost): Promise<void> {
  event.preventDefault();
  const before = host.getState();
  const previousPosition = before.player.pos;
  const previousMapId = before.player.mapId;
  const warp = stepWarp(before, direction, host.maps[before.player.mapId]);
  host.setMoving(true);
  try {
    const next = await host.move(before, direction);
    if (next.player.mapId !== previousMapId) {
      const reason = mapEntryReason(before, host.maps[previousMapId], direction, next.player.mapId);
      if (reason === 'warp') host.playSfx('zone-warp');
      await transitionMap(host.app, warp?.transitionEffect, () => {
        host.setState(next);
        host.syncUi();
      });
      await host.zoneEvents.enter(reason);
    } else host.setState(next);
  } catch (error) {
    console.error('Falha ao carregar zona; movimento não aplicado', error);
    if (host.hudPosition) host.hudPosition.textContent = 'Falha ao carregar zona. Tente novamente.';
    return;
  } finally {
    host.setMoving(false);
  }
  handleMovementResult(previousPosition, previousMapId, host);
}

function handleMovementResult(
  previousPosition: GameState['player']['pos'],
  previousMapId: string,
  host: GameInputHost
): void {
  const state = host.getState();
  const moved = previousMapId !== state.player.mapId || previousPosition.x !== state.player.pos.x || previousPosition.z !== state.player.pos.z;
  if (!moved) host.playSfx('wall-bump');
  const currentMap = host.maps[state.player.mapId];
  if (moved) {
    const triggeredTrainer = findTriggeredTrainer(state, host.maps);
    if (triggeredTrainer) {
      host.setState({ ...state, activeDialogue: { sourceId: triggeredTrainer.id, text: triggeredTrainer.text } });
      host.renderIntro();
      host.syncUi();
      return;
    }
  }
  const method = currentMap ? encounterMethodForTile(currentMap, state.player.pos) : null;
  if (moved && method) startWildEncounter(host, method);
  host.renderIntro();
  host.syncUi();
}

function startWildEncounter(host: EncounterInputHost, method: EncounterMethod): void {
  const state = host.getState();
  const currentMap = host.maps[state.player.mapId];
  if (!currentMap) return;
  if ((method === 'surf' || method.endsWith('_rod')) && !hasSurfEncounterAccess(currentMap, state.player)) return;
  const sources = host.getEncounterSources();
  const source = currentMap.encounters
    ? {
      name: currentMap.name,
      encounterFormat: currentMap.encounterFormat,
      encounters: currentMap.encounters,
    }
    : sources[state.player.mapId];
  const encounter = method === 'horde_a'
    ? source ? rollHordeEncounter(source, resolveRosterSpeciesId) : null
    : resolveEncounter(source, sources, state.player.mapId, method);
  const species = encounter ? findRosterSpecies(encounter.speciesId) : undefined;
  if (!encounter || !species || !host.getParty().some((pokemon) => pokemon.currentHp > 0)) return;
  host.setBattle(startWildBattle(host.getParty(), createWildBattlePokemon(species, encounter.level)));
  host.syncPartyFromBattle();
  host.renderBattle();
}

function resolveEncounter(
  source: ZoneEncounterSource | undefined,
  sources: ZoneEncounterSources,
  mapId: string,
  method: EncounterMethod
): { speciesId: string; level: number } | null {
  if (method.startsWith('horde_')) return null;
  const table = source
    ? encounterTableFromZone(source, method, resolveRosterSpeciesId)
    : resolveEncounterTableForMethod(mapId, method, sources, resolveRosterSpeciesId, MAP_ENCOUNTERS);
  return table ? rollWildEncounter(table) : null;
}
