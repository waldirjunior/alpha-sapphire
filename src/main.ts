import { addBagItem, consumePokeball, createInitialBag, usePotion } from './core/bag';
import {
  type BattleState,
  createPokemonInstance,
  executeBattleTurn,
  healParty,
  rollWildEncounter,
  runFromBattle,
  startTrainerBattle,
  startWildBattle,
  switchActivePokemon,
  throwPokeball,
} from './core/battle';
import {
  createInitialState,
  findTriggeredTrainer,
  interact,
  isTallGrass,
  movePlayer,
} from './core/gameState';
import { deserializeSave, serializeSave } from './core/save';
import type { Direction } from './core/types';
import { MAPS } from './data/maps';
import { MAP_ENCOUNTERS } from './data/pokemon/route101';
import { SPECIES } from './data/pokemon/species';
import { SceneManager } from './engine/SceneManager';

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');
const dialogueBox = document.getElementById('dialogue-box');
const battleOverlay = document.getElementById('battle-overlay');
const battleEnemy = document.getElementById('battle-enemy');
const battlePlayer = document.getElementById('battle-player');
const battleLog = document.getElementById('battle-log');
const battleActions = document.getElementById('battle-actions');

if (!app) {
  throw new Error('Elemento #app não encontrado');
}

const SAVE_STORAGE_KEY = 'alpha_sapphire_web_save_v1';
const saved = (() => {
  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  return raw ? deserializeSave(raw) : null;
})();

const sceneManager = new SceneManager(app);
let state = saved?.state ?? createInitialState('littleroot_town', MAPS);
let starterId: 'treecko' | 'torchic' | 'mudkip' = 'torchic';
let party = saved?.party ?? [createPokemonInstance(SPECIES[starterId], 5)];
let bag = saved?.bag ?? createInitialBag();
let activePartyIndex = 0;
let caughtCount = saved?.caughtCount ?? 0;
let activeBattle: BattleState | null = null;
let activeTrainerId: string | null = null;

function persistSave(): void {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    serializeSave({ version: 1, state, party, bag, caughtCount })
  );
}

const resetBtn = document.getElementById('reset-save');
resetBtn?.addEventListener('click', () => {
  if (activeBattle) return;
  window.localStorage.removeItem(SAVE_STORAGE_KEY);
  state = createInitialState('littleroot_town', MAPS);
  party = [createPokemonInstance(SPECIES[starterId], 5)];
  bag = createInitialBag();
  caughtCount = 0;
  syncUi();
  resetBtn.blur();
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

function renderBattle(): void {
  sceneManager.syncBattle(activeBattle);
  if (!battleOverlay || !battleEnemy || !battlePlayer || !battleLog || !battleActions) return;
  if (!activeBattle) {
    battleOverlay.classList.remove('open');
    return;
  }

  battleOverlay.classList.add('open');
  const b = activeBattle;
  const enemyPrefix = b.isTrainer && b.trainerName ? `${b.trainerName}: ` : 'Selvagem: ';
  battleEnemy.textContent = `${enemyPrefix}${b.enemy.species.name} (Lv.${b.enemy.level}) — HP ${b.enemy.currentHp}/${b.enemy.maxHp}`;
  battlePlayer.textContent = `Seu Pokémon: ${b.player.species.name} (Lv.${b.player.level}) — HP ${b.player.currentHp}/${b.player.maxHp}`;
  battleLog.innerHTML = b.log.slice(-4).map((line) => `<div>${line}</div>`).join('');
  battleActions.innerHTML = '';

  if (b.status === 'ongoing') {
    b.player.moves.forEach((move, idx) => {
      const btn = document.createElement('button');
      btn.textContent = `${move.name} (${move.type})`;
      btn.onclick = () => {
        if (!activeBattle) return;
        activeBattle = executeBattleTurn(activeBattle, idx);
        party[activePartyIndex] = activeBattle.player;
        renderBattle();
      };
      battleActions.appendChild(btn);
    });

    party.forEach((member, idx) => {
      if (idx === activePartyIndex || member.currentHp <= 0) return;
      const swapBtn = document.createElement('button');
      swapBtn.textContent = `Trocar: ${member.species.name} (${member.currentHp}/${member.maxHp})`;
      swapBtn.onclick = () => {
        if (!activeBattle) return;
        party[activePartyIndex] = activeBattle.player;
        activePartyIndex = idx;
        activeBattle = switchActivePokemon(activeBattle, member);
        party[activePartyIndex] = activeBattle.player;
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
        ...activeBattle,
        player: result.pokemon,
        log: [
          ...activeBattle.log,
          `Potion usada em ${result.pokemon.species.name} (${result.pokemon.currentHp}/${result.pokemon.maxHp} HP).`,
        ],
      };
      party[activePartyIndex] = activeBattle.player;
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
        party[activePartyIndex] = activeBattle.player;
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
    if (activeBattle?.status === 'defeat') {
      party[0] = createPokemonInstance(SPECIES[starterId], 5);
      state = createInitialState('littleroot_town', MAPS);
    }
    activeBattle = null;
    activeTrainerId = null;
    persistSave();
    renderBattle();
    syncUi();
  };
  battleActions.appendChild(closeBtn);
}

function syncUi(): void {
  sceneManager.sync(state, MAPS);
  persistSave();
  if (hudPos) {
    const mapName = MAPS[state.player.mapId]?.name ?? state.player.mapId;
    const lead = party[0];
    const leadLabel = lead ? `${lead.species.name} Lv.${lead.level}` : 'Nenhum';
    hudPos.textContent = `Mapa: ${mapName} | Pos: (${state.player.pos.x}, ${state.player.pos.z}) | Time: ${party.length}/6 (${leadLabel}) | Capturados: ${caughtCount} | Mochila: ${bag.pokeballs} Balls, ${bag.potions} Potions`;
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

syncUi();

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

window.addEventListener('keydown', (event) => {
  if (activeBattle) return;

  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
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
        const enemySpecies = SPECIES[trainerSource.trainer.speciesId];
        const healthyIdx = party.findIndex((p) => p.currentHp > 0);
        const lead = healthyIdx >= 0 ? party[healthyIdx] : undefined;
        if (lead && enemySpecies) {
          activePartyIndex = healthyIdx;
          activeTrainerId = trainerSource.id;
          activeBattle = startTrainerBattle(
            lead,
            createPokemonInstance(enemySpecies, trainerSource.trainer.level),
            trainerSource.trainer.name
          );
          renderBattle();
        }
      }
    }
    syncUi();
    return;
  }

  const dir = KEY_TO_DIR[event.code];
  if (!dir) return;

  const prevPos = state.player.pos;
  state = movePlayer(state, dir, MAPS);
  const moved = prevPos.x !== state.player.pos.x || prevPos.z !== state.player.pos.z;
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
      syncUi();
      return;
    }
  }

  if (moved && currentMap && isTallGrass(currentMap, state.player.pos)) {
    const table = MAP_ENCOUNTERS[state.player.mapId];
    const encounter = table ? rollWildEncounter(table) : null;
    const wildSpecies = encounter ? SPECIES[encounter.speciesId] : undefined;
    const healthyIdx = party.findIndex((p) => p.currentHp > 0);
    const lead = healthyIdx >= 0 ? party[healthyIdx] : undefined;
    if (encounter && wildSpecies && lead) {
      activePartyIndex = healthyIdx;
      activeBattle = startWildBattle(lead, createPokemonInstance(wildSpecies, encounter.level));
      renderBattle();
    }
  }

  syncUi();
});

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();
