import { createInitialState } from '../core/gameState';
import type { GameState, GridPosition, MapDefinition } from '../core/types';

export type IntroGender = 'male' | 'female';
export type IntroStep = 'birch' | 'truck' | null;

export function defaultPlayerName(gender: IntroGender): string {
  return gender === 'female' ? 'May' : 'Brendan';
}

export function confirmPlayerDetails(state: GameState, gender: IntroGender, name: string): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      gender,
      playerName: name.trim() || defaultPlayerName(gender),
    },
  };
}

export function completeIntro(state: GameState, startMapId: string, spawnPos: GridPosition): GameState {
  const playerName = state.player.playerName ?? 'Querido(a)';
  return {
    ...state,
    player: { ...state.player, mapId: startMapId, pos: { ...spawnPos }, facing: 'up' },
    storyFlags: { ...state.storyFlags, intro_completed: true },
    activeDialogue: {
      sourceId: 'mom_arrival',
      text: `Mãe: ${playerName}, chegamos a Littleroot Town! Entre em casa pela porta logo à frente para descansar e falar comigo!`,
    },
  };
}

export interface IntroHost {
  overlay: HTMLElement | null;
  card: HTMLElement | null;
  getStep(): IntroStep;
  setStep(step: IntroStep): void;
  getGender(): IntroGender;
  setGender(gender: IntroGender): void;
  getState(): GameState;
  setState(state: GameState): void;
  startMapId: string;
  maps: Record<string, MapDefinition>;
  resetEvents(): void;
  enterEvents(): Promise<void>;
  render(): void;
  syncUi(): void;
}

export function renderIntro(host: IntroHost): void {
  const { overlay, card } = host;
  if (!overlay || !card) return;
  const step = host.getStep();
  if (!step) {
    overlay.classList.remove('open');
    return;
  }

  overlay.classList.add('open');
  card.classList.remove('truck-shaking');
  if (step === 'birch') {
    renderBirchIntro(host, card);
    return;
  }
  renderTruckIntro(host, card);
}

function renderBirchIntro(host: IntroHost, card: HTMLElement): void {
  const gender = host.getGender();
  const defaultName = defaultPlayerName(gender);
  card.innerHTML = `
      <div style="color:#38bdf8;font-weight:700;font-size:15px">Prof. Birch — Boas-vindas a Hoenn</div>
      <div style="line-height:1.5;font-size:14px">
        Olá! Que bom ver você por aqui! Bem-vindo ao incrível mundo dos Pokémon!
        Antes de chegarmos a Littleroot Town, conte-me sobre você:
      </div>
      <div class="intro-genders">
        <button type="button" class="intro-gender-btn${gender === 'male' ? ' active' : ''}" data-gender="male">Garoto (Brendan)</button>
        <button type="button" class="intro-gender-btn${gender === 'female' ? ' active' : ''}" data-gender="female">Garota (May)</button>
      </div>
      <input id="intro-name" type="text" maxlength="12" value="${defaultName}" placeholder="Seu nome" />
      <button type="button" id="intro-next" class="intro-primary-btn">Confirmar e embarcar no caminhão</button>
    `;

  card.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((btn) => {
    btn.onclick = () => {
      const selected = btn.dataset.gender;
      if (selected !== 'male' && selected !== 'female') return;
      host.setGender(selected);
      host.render();
    };
  });

  const nextBtn = document.getElementById('intro-next');
  const nameElement = document.getElementById('intro-name');
  const nameInput = nameElement instanceof HTMLInputElement ? nameElement : null;
  if (!nextBtn) return;
  nextBtn.onclick = () => {
    host.setState(confirmPlayerDetails(host.getState(), gender, nameInput?.value ?? ''));
    host.setStep('truck');
    host.render();
  };
}

function renderTruckIntro(host: IntroHost, card: HTMLElement): void {
  card.classList.add('truck-shaking');
  card.innerHTML = `
    <div style="color:#f59e0b;font-weight:700;font-size:15px">Caminhão de Mudança — Rumo a Littleroot Town</div>
    <div style="line-height:1.6;font-size:14px;color:#e2e8f0">
      <em>Vroom... Clack-clack...</em><br/>
      As caixas da mudança balançam enquanto o caminhão entra em Hoenn.<br/>
      <strong>O caminhão parou!</strong> A porta traseira se abriu em frente à sua nova casa!
    </div>
    <button type="button" id="intro-finish" class="intro-primary-btn">Sair do caminhão</button>
  `;
  const finishBtn = document.getElementById('intro-finish');
  if (!finishBtn) return;
  finishBtn.onclick = () => {
    host.setStep(null);
    const spawnPos = createInitialState(host.startMapId, host.maps).player.pos;
    host.setState(completeIntro(host.getState(), host.startMapId, spawnPos));
    host.resetEvents();
    host.render();
    host.syncUi();
    void host.enterEvents();
  };
}
