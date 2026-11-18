import { addBagItem, consumePokeball, createInitialBag, usePotion } from './core/bag';
import {
  type BattleState,
  createPokemonInstance,
  evolveAfterBattle,
  executeBattleTurn,
  healParty,
  rollWildEncounter,
  runFromBattle,
  startTrainerBattle,
  startWildBattle,
  switchActivePokemon,
  throwPokeball,
  timeOfDayFromHour,
  updateActivePlayer,
} from './core/battle';
import {
  createInitialState,
  findTriggeredTrainer,
  interact,
  isTallGrass,
} from './core/gameState';
import { deserializeSave, serializeSave } from './core/save';
import type { Direction } from './core/types';
import { zoneMaps, startingMapId, saveStorageKey } from './data/maps_v2/runtime';
import { stepWarp } from './core/warps';
import { transitionMap } from './engine/mapTransition';
import { grassTableFromZone } from './core/wildPokemon';

import { getSpeciesByDex } from './core/dex';
import { buildZoneEncounterTables, generatePokemon, resolveEncounterTable, type ZoneEncounterSource } from './core/wildPokemon';
import { MAP_ENCOUNTERS, type WildEncounterEntry } from './data/pokemon/route101';
import { findRosterSpecies, SPECIES } from './data/pokemon/species';
import { SceneManager } from './engine/SceneManager';
import { BgmPlayer } from './engine/audioPlayer';
import { bgmUrl, resolveMapBgm, type ZoneAudioEntry } from './core/zoneAudio';
import { JINGLES, leveledUpDuring, resolveCurrentMusic } from './core/battleAudio';
import { MAP_ZONE_IDS } from './data/audio/mapZones';
import { createGameEvents } from './engine/gameEvents';
import { facingNpc, mapEntryReason } from './engine/eventHost';

const MAPS = zoneMaps.maps;
const START_MAP_ID = startingMapId(window.location.search);
let moving = false;

// Zonas extraídas da ROM (src/data/zones/*.json, A-009) são opcionais: sem elas vale MAP_ENCOUNTERS.
const ZONE_FILES = import.meta.glob<ZoneEncounterSource>('./data/zones/*.json', { import: 'default' });
let zoneEncounterTables: Record<string, WildEncounterEntry[]> = {};

function resolveRosterSpeciesId(dexNumber: number, form: number): string | null {
  const species = getSpeciesByDex(dexNumber, form);
  return findRosterSpecies(species.id) ? species.id : null;
}

async function loadZoneEncounters(mapIds: readonly string[]): Promise<void> {
  const wanted = Object.entries(ZONE_FILES).filter(([path]) => mapIds.some((mapId) => path.endsWith(`_${mapId}.json`)));
  const zones = await Promise.all(wanted.map(([, load]) => load()));
  zoneEncounterTables = buildZoneEncounterTables(zones, resolveRosterSpeciesId);
}

void loadZoneEncounters(Object.keys(MAPS));

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');
const dialogueBox = document.getElementById('dialogue-box');
const battleOverlay = document.getElementById('battle-overlay');
const battleEnemy = document.getElementById('battle-enemy');
const battlePlayer = document.getElementById('battle-player');
const battleLog = document.getElementById('battle-log');
const battleActions = document.getElementById('battle-actions');
const dsPanel = document.getElementById('ds-panel');
const dsTabButtons = document.querySelectorAll<HTMLButtonElement>('#ds-tabs button[data-tab]');
const saveGameBtn = document.getElementById('btn-save-game');
const newGameBtn = document.getElementById('btn-new-game');
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
  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  return raw ? deserializeSave(raw) : null;
})();

const sceneManager = new SceneManager(app);
let state = saved?.state ?? createInitialState(START_MAP_ID, MAPS);
let starterId: 'treecko' | 'torchic' | 'mudkip' = 'torchic';
let party = saved?.party ?? [createPokemonInstance(SPECIES[starterId], 5)];
let bag = saved?.bag ?? createInitialBag();
let activePartyIndex = 0;
let caughtCount = saved?.caughtCount ?? 0;
let activeBattle: BattleState | null = null;
let battleAnimating = false;
let activeTrainerId: string | null = null;
let openDsTab: 'party' | 'bag' | 'pokedex' | null = null;
let activeBagPocket: 'items' | 'balls' | 'key' = 'items';
let introStep: 'birch' | 'truck' | null = state.storyFlags.intro_completed ? null : 'birch';
let pendingGender: 'male' | 'female' = state.player.gender ?? 'male';

// P-008: BGM por zona; zone_audio.json chega por chunk e o áudio só começa após o primeiro gesto.
const bgmPlayer = new BgmPlayer();
bgmPlayer.attachUnlock(window);
let zoneAudio: readonly ZoneAudioEntry[] = [];

function zoneTrackFor(mapId: string): string | null {
  const zoneId = MAPS[mapId]?.zoneId;
  const mapZones = zoneId === undefined ? MAP_ZONE_IDS : { ...MAP_ZONE_IDS, [mapId]: zoneId };
  return resolveMapBgm(mapId, mapZones, zoneAudio);
}

/** Batalha aberta (tema/fanfarra) tem prioridade sobre a BGM da zona; `play` ignora a mesma faixa. */
function syncMusic(): void {
  const track = resolveCurrentMusic(activeBattle, zoneTrackFor(state.player.mapId));
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

function createHpBarMarkup(currentHp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
  const pct = Math.round(ratio * 100);
  const color = ratio > 0.5 ? '#22c55e' : ratio > 0.2 ? '#eab308' : '#ef4444';
  return `<div class="hp-bar-track"><div class="hp-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function persistSave(): void {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    serializeSave({ version: 1, state, party, bag, caughtCount })
  );
}

function startNewGame(): void {
  if (activeBattle || moving) return;
  zoneEvents.reset();
  window.localStorage.removeItem(SAVE_STORAGE_KEY);
  state = createInitialState(START_MAP_ID, MAPS);
  party = [createPokemonInstance(SPECIES[starterId], 5)];
  bag = createInitialBag();
  caughtCount = 0;
  introStep = 'birch';
  openDsTab = null;
  renderIntro();
  syncUi();
}

const resetBtn = document.getElementById('reset-save');
resetBtn?.addEventListener('click', () => {
  startNewGame();
  resetBtn.blur();
});

newGameBtn?.addEventListener('click', () => {
  startNewGame();
  newGameBtn.blur();
});

const starterButtons = document.querySelectorAll<HTMLButtonElement>('#starter-bar button[data-starter]');
starterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (activeBattle) return;
    const id = btn.dataset.starter;
    if (id !== 'treecko' && id !== 'torchic' && id !== 'mudkip') return;
    starterId = id;
    party[0] = createPokemonInstance(SPECIES[starterId], 5);
    starterButtons.forEach((b) => b.classList.toggle('active', b.dataset.starter === starterId));
    persistSave();
    syncUi();
    btn.blur();
  });
});

function syncPartyFromBattle(): void {
  if (!activeBattle) return;
  if (leveledUpDuring(party, activeBattle.playerParty)) playJingle(JINGLES.levelUp);
  party = [...activeBattle.playerParty];
  activePartyIndex = activeBattle.playerActive;
}

function renderBattle(): void {
  sceneManager.syncBattle(activeBattle);
  syncMusic();
  if (!battleOverlay || !battleEnemy || !battlePlayer || !battleLog || !battleActions) return;
  battleActions.inert = battleAnimating;
  if (!activeBattle) {
    battleOverlay.classList.remove('open');
    return;
  }

  battleOverlay.classList.add('open');
  const b = activeBattle;
  const enemyPrefix = b.isTrainer && b.trainerName ? `${b.trainerName}: ` : 'Selvagem: ';
  battleEnemy.innerHTML = `<span>${enemyPrefix}${b.enemy.species.name} (Lv.${b.enemy.level}) — HP ${b.enemy.currentHp}/${b.enemy.maxHp}</span>${createHpBarMarkup(b.enemy.currentHp, b.enemy.maxHp)}`;
  battlePlayer.innerHTML = `<span>Seu Pokémon: ${b.player.species.name} (Lv.${b.player.level}) — HP ${b.player.currentHp}/${b.player.maxHp}</span>${createHpBarMarkup(b.player.currentHp, b.player.maxHp)}`;
  battleLog.innerHTML = b.log.slice(-4).map((line) => `<div>${line}</div>`).join('');
  battleActions.innerHTML = '';

  if (b.status === 'ongoing') {
    b.player.moves.forEach((move, idx) => {
      const btn = document.createElement('button');
      btn.textContent = `${move.name} (${move.type}) ${move.currentPp}/${move.maxPp} PP`;
      btn.disabled = move.currentPp === 0 && b.player.moves.some((slot) => slot.currentPp > 0);
      btn.onclick = async () => {
        if (!activeBattle || battleAnimating) return;
        const before = activeBattle;
        const next = executeBattleTurn(before, idx);
        battleAnimating = true;
        battleActions.querySelectorAll('button').forEach((button) => { button.disabled = true; });
        sceneManager.playAttackEffect(move.type);
        try {
          await sceneManager.playBattleEvents(next.events ?? []);
          if (activeBattle === before) activeBattle = next;
        } finally {
          battleAnimating = false;
          syncPartyFromBattle();
          renderBattle();
        }
      };
      battleActions.appendChild(btn);
    });

    party.forEach((member, idx) => {
      if (idx === activePartyIndex || member.currentHp <= 0) return;
      const swapBtn = document.createElement('button');
      swapBtn.textContent = `Trocar: ${member.species.name} (${member.currentHp}/${member.maxHp})`;
      swapBtn.onclick = () => {
        if (!activeBattle) return;
        activeBattle = switchActivePokemon(activeBattle, idx);
        syncPartyFromBattle();
        renderBattle();
      };
      battleActions.appendChild(swapBtn);
    });

    const potionBtn = document.createElement('button');
    potionBtn.textContent = `Potion (${bag.potions})`;
    potionBtn.disabled = bag.potions <= 0 || b.player.currentHp >= b.player.maxHp;
    potionBtn.onclick = () => {
      if (!activeBattle) return;
      const result = usePotion(bag, activeBattle.player);
      if (!result.used) return;
      bag = result.bag;
      activeBattle = {
        ...updateActivePlayer(activeBattle, result.pokemon),
        log: [
          ...activeBattle.log,
          `Potion usada em ${result.pokemon.species.name} (${result.pokemon.currentHp}/${result.pokemon.maxHp} HP).`,
        ],
      };
      syncPartyFromBattle();
      renderBattle();
    };
    battleActions.appendChild(potionBtn);

    if (!b.isTrainer) {
      const ballBtn = document.createElement('button');
      ballBtn.textContent = `Poké Ball (${bag.pokeballs})`;
      ballBtn.disabled = bag.pokeballs <= 0;
      ballBtn.onclick = () => {
        if (!activeBattle) return;
        const consumed = consumePokeball(bag);
        if (!consumed.ok) return;
        bag = consumed.bag;
        activeBattle = throwPokeball(activeBattle);
        syncPartyFromBattle();
        if (activeBattle.status === 'caught') {
          caughtCount += 1;
          if (party.length < 6) {
            party.push(activeBattle.enemy);
          }
        }
        renderBattle();
      };
      battleActions.appendChild(ballBtn);

      const runBtn = document.createElement('button');
      runBtn.textContent = 'Fugir';
      runBtn.onclick = () => {
        if (!activeBattle) return;
        activeBattle = runFromBattle(activeBattle);
        renderBattle();
      };
      battleActions.appendChild(runBtn);
    }
    return;
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Voltar ao mapa';
  closeBtn.onclick = () => {
    if (activeBattle?.isTrainer && activeBattle.status === 'victory' && activeTrainerId) {
      state = {
        ...state,
        storyFlags: {
          ...state.storyFlags,
          [`defeated_trainer:${activeTrainerId}`]: true,
        },
      };
    }
    if (activeBattle && activeBattle.status !== 'defeat') {
      party = evolveAfterBattle(party, activeBattle.leveledUp, timeOfDayFromHour(new Date().getHours())).party;
    }
    if (activeBattle?.status === 'defeat') {
      party[0] = createPokemonInstance(SPECIES[starterId], 5);
      state = createInitialState(START_MAP_ID, MAPS);
    }
    activeBattle = null;
    activeTrainerId = null;
    persistSave();
    renderBattle();
    renderIntro();
  syncUi();
  };
  battleActions.appendChild(closeBtn);
}

function renderDsPanel(): void {
  dsTabButtons.forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.tab === openDsTab)
  );
  if (!dsPanel) return;
  if (!openDsTab || activeBattle) {
    dsPanel.classList.remove('open');
    dsPanel.innerHTML = '';
    return;
  }

  dsPanel.classList.add('open');
  dsPanel.innerHTML = '';

  if (openDsTab === 'party') {
    const grid = document.createElement('div');
    grid.className = 'oras-party-grid';
    for (let idx = 0; idx < 6; idx++) {
      const member = party[idx];
      const card = document.createElement('div');
      card.className = `oras-party-card${idx === 0 ? ' lead' : ''}`;
      if (!member) {
        card.innerHTML = `<div style="color:#64748b">Slot ${idx + 1} — Vazio</div>`;
        grid.appendChild(card);
        continue;
      }
      const xpPct = member.nextLevelXp > 0 ? Math.min(100, Math.round((member.xp / member.nextLevelXp) * 100)) : 0;
      const info = document.createElement('div');
      info.innerHTML = `<div><strong>${member.species.name}</strong> <span style="color:#93c5fd">Lv.${member.level}</span></div>
        <div style="font-size:11px;color:#cbd5e1">${member.currentHp}/${member.maxHp} HP · ${member.species.types.join('/')}</div>
        ${createHpBarMarkup(member.currentHp, member.maxHp)}
        <div style="font-size:10px;color:#60a5fa;margin-top:2px">EXP ${xpPct}%</div>`;
      card.appendChild(info);

      if (member.currentHp < member.maxHp && bag.potions > 0) {
        const healBtn = document.createElement('button');
        healBtn.textContent = 'Usar Potion';
        healBtn.onclick = () => {
          const res = usePotion(bag, member);
          if (!res.used) return;
          bag = res.bag;
          party[idx] = res.pokemon;
          renderIntro();
  syncUi();
        };
        card.appendChild(healBtn);
      }
      grid.appendChild(card);
    }
    dsPanel.appendChild(grid);
    return;
  }

  if (openDsTab === 'bag') {
    const pocketBar = document.createElement('div');
    pocketBar.className = 'oras-bag-tabs';
    const pockets: Array<{ id: 'items' | 'balls' | 'key'; label: string }> = [
      { id: 'items', label: 'Itens' },
      { id: 'balls', label: 'Poké Balls' },
      { id: 'key', label: 'Itens-Chave' },
    ];
    for (const pocket of pockets) {
      const pBtn = document.createElement('button');
      pBtn.textContent = pocket.label;
      if (activeBagPocket === pocket.id) pBtn.classList.add('active');
      pBtn.onclick = () => {
        activeBagPocket = pocket.id;
        renderDsPanel();
      };
      pocketBar.appendChild(pBtn);
    }
    dsPanel.appendChild(pocketBar);

    const list =
      activeBagPocket === 'items'
        ? [{ label: 'Potion', count: bag.potions, desc: 'Restaura 20 HP de um Pokémon.' }]
        : activeBagPocket === 'balls'
          ? [{ label: 'Poké Ball', count: bag.pokeballs, desc: 'Captura Pokémon selvagens em batalha.' }]
          : bag.keyItems.length
            ? bag.keyItems.map((k) => ({ label: k, count: 1, desc: 'Item-chave de aventura.' }))
            : [{ label: 'PokéNav Plus', count: 1, desc: 'Equipado na tela inferior do 3DS.' }];

    for (const item of list) {
      const row = document.createElement('div');
      row.className = 'ds-item';
      row.innerHTML = `<div><strong>${item.label}</strong><div style="color:#94a3b8">${item.desc}</div></div><span>x${item.count}</span>`;
      dsPanel.appendChild(row);
    }
    return;
  }

  const dexGrid = document.createElement('div');
  dexGrid.className = 'oras-dex-grid';
  const ownedIds = new Set(party.map((p) => p.species.id));
  for (const sp of Object.values(SPECIES)) {
    const hasIt = ownedIds.has(sp.id);
    const cell = document.createElement('div');
    cell.className = `ds-item${hasIt ? ' caught' : ''}`;
    cell.innerHTML = `<div><strong>#${sp.dexNumber} ${sp.name}</strong><div style="color:#94a3b8">${sp.types.join('/')}</div></div><span>${hasIt ? 'Registrado' : '---'}</span>`;
    dexGrid.appendChild(cell);
  }
  dsPanel.appendChild(dexGrid);
}

function renderIntro(): void {
  if (!introOverlay || !introCard) return;
  if (!introStep) {
    introOverlay.classList.remove('open');
    return;
  }

  introOverlay.classList.add('open');
  introCard.classList.remove('truck-shaking');

  if (introStep === 'birch') {
    const defaultName = pendingGender === 'female' ? 'May' : 'Brendan';
    introCard.innerHTML = `
      <div style="color:#38bdf8;font-weight:700;font-size:15px">Prof. Birch — Boas-vindas a Hoenn</div>
      <div style="line-height:1.5;font-size:14px">
        Olá! Que bom ver você por aqui! Bem-vindo ao incrível mundo dos Pokémon!
        Antes de chegarmos a Littleroot Town, conte-me sobre você:
      </div>
      <div class="intro-genders">
        <button type="button" class="intro-gender-btn${pendingGender === 'male' ? ' active' : ''}" data-gender="male">Garoto (Brendan)</button>
        <button type="button" class="intro-gender-btn${pendingGender === 'female' ? ' active' : ''}" data-gender="female">Garota (May)</button>
      </div>
      <input id="intro-name" type="text" maxlength="12" value="${defaultName}" placeholder="Seu nome" />
      <button type="button" id="intro-next" class="intro-primary-btn">Confirmar e embarcar no caminhão</button>
    `;

    introCard.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((btn) => {
      btn.onclick = () => {
        const g = btn.dataset.gender;
        if (g !== 'male' && g !== 'female') return;
        pendingGender = g;
        renderIntro();
      };
    });

    const nextBtn = document.getElementById('intro-next');
    const nameInput = document.getElementById('intro-name') as HTMLInputElement | null;
    if (nextBtn) {
      nextBtn.onclick = () => {
        const chosenName = nameInput?.value.trim() || defaultName;
        state = {
          ...state,
          player: {
            ...state.player,
            gender: pendingGender,
            playerName: chosenName,
          },
        };
        introStep = 'truck';
        renderIntro();
      };
    }
    return;
  }

  introCard.classList.add('truck-shaking');
  introCard.innerHTML = `
    <div style="color:#f59e0b;font-weight:700;font-size:15px">Caminhão de Mudança — Rumo a Littleroot Town</div>
    <div style="line-height:1.6;font-size:14px;color:#e2e8f0">
      <em>Vroom... Clack-clack...</em><br/>
      As caixas da mudança balançam enquanto o caminhão entra em Hoenn.<br/>
      <strong>O caminhão parou!</strong> A porta traseira se abriu em frente à sua nova casa!
    </div>
    <button type="button" id="intro-finish" class="intro-primary-btn">Sair do caminhão</button>
  `;
  const finishBtn = document.getElementById('intro-finish');
  if (finishBtn) {
    finishBtn.onclick = () => {
      introStep = null;
      state = {
        ...state,
        player: {
          ...state.player,
          mapId: START_MAP_ID,
          pos: { ...createInitialState(START_MAP_ID, MAPS).player.pos },
          facing: 'up',
        },
        storyFlags: {
          ...state.storyFlags,
          intro_completed: true,
        },
        activeDialogue: {
          sourceId: 'mom_arrival',
          text: `Mãe: ${state.player.playerName ?? 'Querido(a)'}, chegamos a Littleroot Town! Entre em casa pela porta logo à frente para descansar e falar comigo!`,
        },
      };
      zoneEvents.reset();
      renderIntro();
      syncUi();
      void zoneEvents.enter();
    };
  }
}

dsTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab !== 'party' && tab !== 'bag' && tab !== 'pokedex') return;
    openDsTab = openDsTab === tab ? null : tab;
    renderDsPanel();
    btn.blur();
  });
});

saveGameBtn?.addEventListener('click', () => {
  persistSave();
  saveGameBtn.textContent = 'Salvo!';
  window.setTimeout(() => {
    saveGameBtn.textContent = 'Salvar';
  }, 1200);
  saveGameBtn.blur();
});

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
      dialogueBox.textContent = `${state.activeDialogue.text}\n\n[Espaço / Enter para fechar]`;
      dialogueBox.classList.add('open');
    } else {
      dialogueBox.textContent = '';
      dialogueBox.classList.remove('open');
    }
  }
}

const zoneEvents = createGameEvents(() => state, next => { state = next; }, MAPS, syncUi, app);

renderIntro();
syncUi();
void zoneEvents.enter();

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

window.addEventListener('keydown', async (event) => {
  if (activeBattle || introStep || moving) return;

  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    if (zoneEvents.busy || zoneEvents.interactionActive) { await zoneEvents.advance(); return; }
    const npc = !state.activeDialogue && facingNpc(state.player, MAPS[state.player.mapId]);
    if (npc) {
      if (!await zoneEvents.interact(npc)) {
        state = { ...state, activeDialogue: { sourceId: npc.id, text: 'Olá! Bem-vindo a Hoenn.' } };
        syncUi();
      }
      return;
    }
    if (zoneEvents.canAdvance) { await zoneEvents.advance(); return; }
    const wasDialogueOpen = Boolean(state.activeDialogue);
    const prevSourceId = state.activeDialogue?.sourceId;
    const hadLabGift = Boolean(state.storyFlags.visited_birch_lab);
    state = interact(state, MAPS);
    const sourceId = state.activeDialogue?.sourceId;
    if (
      sourceId === 'oldale_pokecenter' ||
      sourceId === 'nurse_joy_oldale' ||
      sourceId === 'mom_heal_interior'
    ) {
      party = healParty(party);
      playJingle(JINGLES.heal);
    }
    if (!hadLabGift && state.storyFlags.visited_birch_lab) {
      bag = addBagItem(bag, 'pokeballs', 5);
      bag = addBagItem(bag, 'potions', 2);
    }
    if (wasDialogueOpen && prevSourceId) {
      const trainerSource = MAPS[state.player.mapId]?.interactables?.find(
        (item) => item.id === prevSourceId && item.trainer
      );
      if (trainerSource?.trainer && !state.storyFlags[`defeated_trainer:${trainerSource.id}`]) {
        const trainer = trainerSource.trainer;
        const enemyTeam = (trainer.team ?? [trainer]).flatMap((member) => {
          const species = findRosterSpecies(member.speciesId);
          return species ? [generatePokemon(species, member.level, Math.random)] : [];
        });
        if (party.some((p) => p.currentHp > 0) && enemyTeam.length > 0) {
          activeTrainerId = trainerSource.id;
          activeBattle = startTrainerBattle(party, enemyTeam, trainer.name);
          syncPartyFromBattle();
          renderBattle();
        }
      }
    }
    renderIntro();
  syncUi();
    return;
  }

  const dir = KEY_TO_DIR[event.code];
  if (!dir || zoneEvents.busy) return;

  event.preventDefault();
  const prevPos = state.player.pos;
  const previousMapId = state.player.mapId;
  const warp = stepWarp(state, dir, MAPS[state.player.mapId]);
  moving = true;
  try {
    const next = await zoneMaps.move(state, dir);
    if (next.player.mapId !== previousMapId) {
      const reason = mapEntryReason(state, MAPS[previousMapId], dir, next.player.mapId);
      await transitionMap(app, warp?.transitionEffect, () => { state = next; syncUi(); });
      await zoneEvents.enter(reason);
    } else state = next;
  } catch (error) {
    console.error('Falha ao carregar zona; movimento não aplicado', error);
    if (hudPos) hudPos.textContent = 'Falha ao carregar zona. Tente novamente.';
    return;
  } finally {
    moving = false;
  }
  const moved = previousMapId !== state.player.mapId || prevPos.x !== state.player.pos.x || prevPos.z !== state.player.pos.z;
  const currentMap = MAPS[state.player.mapId];

  if (moved) {
    const triggeredTrainer = findTriggeredTrainer(state, MAPS);
    if (triggeredTrainer) {
      state = {
        ...state,
        activeDialogue: {
          sourceId: triggeredTrainer.id,
          text: triggeredTrainer.text,
        },
      };
      renderIntro();
  syncUi();
      return;
    }
  }

  if (moved && currentMap && isTallGrass(currentMap, state.player.pos)) {
    const table = currentMap.encounters
      ? grassTableFromZone({ name: currentMap.name, encounters: currentMap.encounters }, resolveRosterSpeciesId)
      : resolveEncounterTable(state.player.mapId, zoneEncounterTables, MAP_ENCOUNTERS);
    const encounter = table ? rollWildEncounter(table) : null;
    const wildSpecies = encounter ? findRosterSpecies(encounter.speciesId) : undefined;
    if (encounter && wildSpecies && party.some((p) => p.currentHp > 0)) {
      activeBattle = startWildBattle(party, generatePokemon(wildSpecies, encounter.level, Math.random));
      syncPartyFromBattle();
      renderBattle();
    }
  }

  renderIntro();
  syncUi();
});

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();
