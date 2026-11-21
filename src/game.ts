import { createInitialBag } from './core/bag';
import {
  type BattleState,
  type PendingMoveLearn,
  createPokemonInstance,
  startWildBattle,
} from './core/battle';
import type { ZoneEncounterSource } from './core/wildPokemon';
import type { AmxPokemon } from './core/amxTypes';
import { createInitialState } from './core/gameState';
import { createPokedex, recordCaughtSpecies, recordSeenSpecies } from './core/pokedex';
import { zoneMaps, startingMapId, saveStorageKey } from './data/maps_v2/runtime';
import { SPECIES } from './data/pokemon/species';
import { SceneManager } from './engine/SceneManager';
import { BgmPlayer } from './engine/audioPlayer';
import { bgmUrl, resolveMapBgm, type ZoneAudioEntry } from './core/zoneAudio';
import { resolveCurrentMusic, type BattleMusicKind, type SfxCue } from './core/battleAudio';
import { MAP_ZONE_IDS } from './data/audio/mapZones';
import { createGameEvents } from './engine/gameEvents';
import { loadZoneEncounters } from './engine/zoneEncounterLoader';
import { bindGameInput } from './game/input';
import { renderBattle as renderBattleUi, resolveBattleMusicContext, syncPartyFromBattle as syncPartyUi } from './game/battleUi';
import {
  bindMenuEvents,
  renderDsPanel as renderMenuPanel,
  splitDialogueSpeaker,
  type MenuTab,
  type StarterId,
} from './game/menus';
import { loadAudioPreferences, saveAudioPreferences, type AudioPreferences } from './game/audioPreferences';
import { renderIntro as renderIntroUi, type IntroGender, type IntroStep } from './game/intro';
import { clearSavedGame, loadSavedGame, storeSavedGame } from './game/saveStorage';
import { createWildBattlePokemon } from './game/wildBattle';

const MAPS = zoneMaps.maps;
const START_MAP_ID = startingMapId(window.location.search);
let moving = false;

let zoneEncounterSources: Record<string, ZoneEncounterSource> = {};
void loadZoneEncounters(Object.keys(MAPS)).then((sources) => { zoneEncounterSources = sources; });

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');
const dialogueBox = document.getElementById('dialogue-box');
const dialogueName = dialogueBox?.querySelector<HTMLElement>('[data-dialogue-name]') ?? null;
const dialogueText = dialogueBox?.querySelector<HTMLElement>('[data-dialogue-text]') ?? null;
const dialoguePrompt = dialogueBox?.querySelector<HTMLElement>('[data-dialogue-prompt]') ?? null;
const battleOverlay = document.getElementById('battle-overlay');
const battleEnemy = document.getElementById('battle-enemy');
const battlePlayer = document.getElementById('battle-player');
const battleLog = document.getElementById('battle-log');
const battleActions = document.getElementById('battle-actions');
const battlePrompt = document.getElementById('battle-prompt');
const battlePromptTitle = document.getElementById('battle-prompt-title');
const battlePromptMessage = document.getElementById('battle-prompt-message');
const battlePromptActions = document.getElementById('battle-prompt-actions');
const dsPanel = document.getElementById('ds-panel');
const dsTabButtons = document.querySelectorAll<HTMLButtonElement>('#ds-tabs button[data-tab]');
const saveGameBtn = document.getElementById('btn-save-game');
const newGameBtn = document.getElementById('btn-new-game');
const audioVolumeSlider = document.querySelector<HTMLInputElement>('#audio-volume');
const audioVolumeOutput = document.querySelector<HTMLOutputElement>('#audio-volume-value');
const audioMuteButton = document.querySelector<HTMLButtonElement>('#btn-audio-mute');
const starterBar = document.getElementById('starter-bar');
const introOverlay = document.getElementById('intro-overlay');
const introCard = document.getElementById('intro-card');

if (starterBar && new URLSearchParams(window.location.search).get('debug') === '1') {
  starterBar.classList.add('debug-open');
}

if (!app) {
  throw new Error('Elemento #app não encontrado');
}

const SAVE_STORAGE_KEY = saveStorageKey(window.location.search);
const saved = (() => {
  return loadSavedGame(window.localStorage, SAVE_STORAGE_KEY);
})();

const bgmPlayer = new BgmPlayer();
let audioPreferences = loadAudioPreferences(window.localStorage);
bgmPlayer.setVolume(audioPreferences.volume / 100);
bgmPlayer.setMuted(audioPreferences.muted);
bgmPlayer.attachUnlock(window);
const sceneManager = new SceneManager(app, (cue, native) => bgmPlayer.playSfx(cue, native));
let state = saved?.state ?? createInitialState(START_MAP_ID, MAPS);
let starterId: 'treecko' | 'torchic' | 'mudkip' = 'torchic';
let party = saved?.party ?? [createPokemonInstance(SPECIES[starterId], 5)];
let pokedex = saved?.pokedex ?? createPokedex(party);
let bag = saved?.bag ?? createInitialBag();
let activePartyIndex = 0;
let caughtCount = saved?.caughtCount ?? 0;
let pendingMoves: PendingMoveLearn[] = saved?.pendingMoves ?? [];
let activeBattle: BattleState | null = null;
let activeBattleMusicContext: BattleMusicKind | null = null;
let battleAnimating = false;
let activeTrainerId: string | null = null;
let openDsTab: MenuTab | null = null;
let selectedHoennMapLocationId: string | null = null;
let activeBagPocket: 'items' | 'balls' | 'key' = 'items';
let introStep: IntroStep = state.storyFlags.intro_completed ? null : 'birch';
let pendingGender: IntroGender = state.player.gender ?? 'male';
let resolveStarterChoice: ((starter: StarterId | null) => void) | null = null;
let resolveEventBattle: ((result: number) => void) | null = null;

// P-008: BGM por zona; zone_audio.json chega por chunk e o áudio só começa após o primeiro gesto.
let zoneAudio: readonly ZoneAudioEntry[] = [];

function zoneTrackFor(mapId: string): string | null {
  const zoneId = MAPS[mapId]?.zoneId;
  const mapZones = zoneId === undefined ? MAP_ZONE_IDS : { ...MAP_ZONE_IDS, [mapId]: zoneId };
  return resolveMapBgm(mapId, mapZones, zoneAudio);
}

function setActiveBattle(battle: BattleState | null): void {
  if (battle && !activeBattle && pendingMoves.length > 0) {
    battle = { ...battle, pendingMoves: [...pendingMoves, ...battle.pendingMoves] };
  }
  if (!battle && activeBattle) pendingMoves = [];
  if (battle) pokedex = recordSeenSpecies(pokedex, battle.enemy.species.id);
  activeBattle = battle;
  activeBattleMusicContext = resolveBattleMusicContext(battle);
}

/** Batalha aberta (tema/fanfarra) tem prioridade sobre a BGM da zona; `play` ignora a mesma faixa. */
function syncMusic(): void {
  const battle = activeBattle ? { ...activeBattle, context: activeBattleMusicContext ?? undefined } : null;
  const track = resolveCurrentMusic(battle, zoneTrackFor(state.player.mapId));
  document.body.dataset.bgm = track ?? '';
  if (track) void bgmPlayer.play(bgmUrl(import.meta.env.BASE_URL, track));
  else bgmPlayer.stop();
}

function playJingle(name: string): void {
  document.body.dataset.jingle = name;
  void bgmPlayer.playJingle(bgmUrl(import.meta.env.BASE_URL, name));
}

void import('./data/zone_audio.json').then((module) => {
  zoneAudio = module.default;
  syncMusic();
});

function persistSave(): void {
  storeSavedGame(window.localStorage, SAVE_STORAGE_KEY, {
    version: 1, state, party, bag, caughtCount, pokedex, pendingMoves,
  });
}

function setParty(nextParty: typeof party): void {
  party = nextParty;
  for (const pokemon of nextParty) pokedex = recordCaughtSpecies(pokedex, pokemon.species.id);
}

function setStarterChoiceVisible(visible: boolean): void {
  if (!starterBar) return;
  const debug = new URLSearchParams(window.location.search).get('debug') === '1';
  const label = starterBar.querySelector('span');
  if (label) label.textContent = visible ? 'Escolha seu inicial:' : 'Debug Inicial:';
  if (visible || debug) starterBar.classList.add('debug-open');
  else starterBar.classList.remove('debug-open');
}

function requestStarterChoice(active: () => boolean): Promise<{ handle: number; pokemon: AmxPokemon } | undefined> {
  if (!starterBar || !active() || resolveStarterChoice) return Promise.resolve(undefined);
  setStarterChoiceVisible(true);
  return new Promise(resolve => {
    resolveStarterChoice = starter => {
      resolveStarterChoice = null;
      setStarterChoiceVisible(false);
      if (!starter || !active()) { resolve(undefined); return; }
      const species = SPECIES[starter];
      const selected = party[0] ?? createPokemonInstance(species, 5);
      state = { ...state, storyFlags: { ...state.storyFlags, starter_chosen: true } };
      syncUi();
      const handle = species.dexNumber;
      resolve({ handle, pokemon: { handle, species: handle, hp: selected.currentHp, maxHp: selected.maxHp,
        isEgg: false, nickname: species.name, status: Number(selected.status !== null) } });
    };
  });
}

function completeStarterChoice(starter: StarterId): void {
  resolveStarterChoice?.(starter);
}

function isBirchBattle(args: readonly number[]): boolean {
  return args.length === 4 && args[0] === 0 && args[1] === 1 && args[2] === 0 && args[3] === -1;
}

function startEventBattle(args: readonly number[], amxParty: readonly AmxPokemon[], active: () => boolean): Promise<number | undefined> {
  if (!active() || state.player.mapId !== 'zone_0023' || !isBirchBattle(args) || !amxParty.length || !party.length || resolveEventBattle) {
    return Promise.resolve(undefined);
  }
  return new Promise(resolve => {
    resolveEventBattle = resolve;
    const enemy = createWildBattlePokemon(SPECIES.poochyena, 3);
    setActiveBattle(startWildBattle(party, enemy));
    syncPartyFromBattle();
    renderBattle();
  });
}

function finishEventBattle(battle: BattleState | null): void {
  const resolve = resolveEventBattle;
  if (!resolve) return;
  resolveEventBattle = null;
  resolve(battle?.status === 'victory' ? 0 : 1);
}

function startNewGame(): void {
  if (activeBattle || moving) return;
  resolveStarterChoice?.(null);
  zoneEvents.reset();
  clearSavedGame(window.localStorage, SAVE_STORAGE_KEY);
  state = createInitialState(START_MAP_ID, MAPS);
  party = [createPokemonInstance(SPECIES[starterId], 5)];
  pokedex = createPokedex(party);
  bag = createInitialBag();
  caughtCount = 0;
  pendingMoves = [];
  introStep = 'birch';
  openDsTab = null;
  selectedHoennMapLocationId = null;
  renderIntro();
  syncUi();
}

const resetBtn = document.getElementById('reset-save');
const starterButtons = document.querySelectorAll<HTMLButtonElement>('#starter-bar button[data-starter]');

function syncPartyFromBattle(): void {
  syncPartyUi(battleHost);
}

function renderBattle(): void {
  renderBattleUi(battleHost);
}

function renderDsPanel(): void {
  renderMenuPanel(menuHost);
}

function renderIntro(): void {
  renderIntroUi(introHost);
}

function syncUi(): void {
  sceneManager.sync(state, MAPS);
  syncMusic();
  persistSave();
  renderDsPanel();
  if (hudPos) {
    const mapName = MAPS[state.player.mapId]?.name ?? state.player.mapId;
    const playerName = state.player.playerName ?? 'Brendan';
    hudPos.textContent = `${mapName} · ${playerName} (${state.player.pos.x}, ${state.player.pos.z})`;
  }
  if (dialogueBox) {
    if (state.activeDialogue) {
      const line = splitDialogueSpeaker(state.activeDialogue.text);
      if (dialogueName) {
        dialogueName.textContent = line.speaker ? `${line.speaker}:` : '';
        dialogueName.hidden = !line.speaker;
      }
      if (dialogueText) dialogueText.textContent = line.text;
      if (dialoguePrompt) dialoguePrompt.textContent = '[Espaço / Enter para fechar]';
      dialogueBox.classList.add('open');
    } else {
      if (dialogueName) dialogueName.textContent = '';
      if (dialogueText) dialogueText.textContent = '';
      if (dialoguePrompt) dialoguePrompt.textContent = '';
      if (dialogueName) dialogueName.hidden = true;
      dialogueBox.classList.remove('open');
    }
  }
}

const zoneEvents = createGameEvents(() => state, next => { state = next; }, MAPS, syncUi, app, sceneManager.events,
  { chooseStarter: requestStarterChoice, battle: startEventBattle }, cue => sceneManager.playSfx(cue));

const battleHost = {
  overlay: battleOverlay,
  enemy: battleEnemy,
  player: battlePlayer,
  log: battleLog,
  actions: battleActions,
  prompt: battlePrompt,
  promptTitle: battlePromptTitle,
  promptMessage: battlePromptMessage,
  promptActions: battlePromptActions,
  scene: sceneManager,
  getBattle: () => activeBattle,
  setBattle: setActiveBattle,
  isAnimating: () => battleAnimating,
  setAnimating: (value: boolean) => { battleAnimating = value; },
  getParty: () => party,
  setParty,
  getPokedex: () => pokedex,
  setPokedex: (nextPokedex: typeof pokedex) => { pokedex = nextPokedex; },
  getActivePartyIndex: () => activePartyIndex,
  setActivePartyIndex: (index: number) => { activePartyIndex = index; },
  getActiveTrainerId: () => activeTrainerId,
  setActiveTrainerId: (id: string | null) => { activeTrainerId = id; },
  getBag: () => bag,
  setBag: (nextBag: typeof bag) => { bag = nextBag; },
  incrementCaughtCount: () => { caughtCount += 1; },
  getState: () => state,
  setState: (nextState: typeof state) => { state = nextState; },
  getStarterId: () => starterId,
  onClose: finishEventBattle,
  startMapId: START_MAP_ID,
  maps: MAPS,
  playJingle,
  syncMusic,
  renderIntro,
  syncUi,
  persistSave,
};

const menuHost = {
  panel: dsPanel,
  tabButtons: dsTabButtons,
  getOpenTab: () => openDsTab,
  setOpenTab: (tab: MenuTab | null) => {
    const previous = openDsTab;
    openDsTab = tab;
    if (tab && previous === null) sceneManager.playSfx('menu-open');
    else if (tab && previous !== tab) sceneManager.playSfx('menu-select');
  },
  getActiveBattle: () => activeBattle,
  getParty: () => party,
  getPokedex: () => pokedex,
  setPokedex: (nextPokedex: typeof pokedex) => { pokedex = nextPokedex; },
  getPendingMoves: () => pendingMoves,
  setPendingMoves: (nextMoves: PendingMoveLearn[]) => { pendingMoves = nextMoves; },
  getBag: () => bag,
  setBag: (nextBag: typeof bag) => { bag = nextBag; },
  setParty,
  getActiveBagPocket: () => activeBagPocket,
  setActiveBagPocket: (pocket: typeof activeBagPocket) => { activeBagPocket = pocket; },
  getPlayerMap: () => {
    const zoneName = MAPS[state.player.mapId]?.name;
    return zoneName ? { mapId: state.player.mapId, zoneName } : { mapId: state.player.mapId };
  },
  getPlayerGender: () => state.player.gender ?? 'male',
  getSelectedMapLocationId: () => selectedHoennMapLocationId,
  setSelectedMapLocationId: (locationId: string) => { selectedHoennMapLocationId = locationId; },
  renderIntro,
  syncUi,
  persistSave,
};

const introHost = {
  overlay: introOverlay,
  card: introCard,
  getStep: () => introStep,
  setStep: (step: IntroStep) => { introStep = step; },
  getGender: () => pendingGender,
  setGender: (gender: IntroGender) => { pendingGender = gender; },
  getState: () => state,
  setState: (nextState: typeof state) => { state = nextState; },
  startMapId: START_MAP_ID,
  maps: MAPS,
  resetEvents: () => zoneEvents.reset(),
  enterEvents: () => zoneEvents.enter(),
  render: renderIntro,
  syncUi,
};

const menuControlHost = {
  ...menuHost,
  resetButton: resetBtn,
  newGameButton: newGameBtn,
  saveButton: saveGameBtn,
  starterButtons,
  audioVolumeSlider,
  audioVolumeOutput,
  audioMuteButton,
  window,
  startNewGame,
  isBattleActive: () => Boolean(activeBattle),
  createStarter: (id: 'treecko' | 'torchic' | 'mudkip') => createPokemonInstance(SPECIES[id], 5),
  setStarterId: (id: 'treecko' | 'torchic' | 'mudkip') => { starterId = id; },
  onStarterSelected: completeStarterChoice,
  persistSave,
  renderDsPanel,
  getAudioPreferences: () => audioPreferences,
  setAudioPreferences: (preferences: AudioPreferences) => {
    audioPreferences = preferences;
    saveAudioPreferences(window.localStorage, preferences);
    bgmPlayer.setVolume(preferences.volume / 100);
    bgmPlayer.setMuted(preferences.muted);
  },
};

bindMenuEvents(menuControlHost);
dsPanel?.addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('button')) sceneManager.playSfx('menu-select');
});

const inputHost = {
  maps: MAPS,
  app,
  hudPosition: hudPos,
  zoneEvents,
  getEncounterSources: () => zoneEncounterSources,
  move: zoneMaps.move,
  getState: () => state,
  setState: (nextState: typeof state) => { state = nextState; },
  getBattle: () => activeBattle,
  setBattle: (battle: BattleState) => { setActiveBattle(battle); },
  getIntroStep: () => introStep,
  getMoving: () => moving,
  setMoving: (value: boolean) => { moving = value; },
  getParty: () => party,
  setParty,
  getBag: () => bag,
  setBag: (nextBag: typeof bag) => { bag = nextBag; },
  setActiveTrainerId: (id: string) => { activeTrainerId = id; },
  renderIntro,
  syncUi,
  syncPartyFromBattle,
  renderBattle,
  playSfx: (cue: SfxCue) => sceneManager.playSfx(cue),
};

renderIntro();
syncUi();
void zoneEvents.enter();

bindGameInput(window, inputHost);

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();
