import * as THREE from 'three';
import { loadBattleTables } from '../core/battleTables';
import { createInitialState } from '../core/gameState';
import type { GameState, MapDefinition } from '../core/types';
import { groundHeight } from '../core/groundHeight';
import { bundledBattleTableLoader } from '../data/battle/loader';
import { zoneMapId } from '../data/maps_v2/loader';
import type { SceneInspection, SceneManager } from '../engine/SceneManager';
import { AssetTracker, waitForIdleFrames } from './assetTracker';
import { avatarMetrics, voidRatio } from './frameMetrics';
import type { ProbeOutcome, ProbeReport } from './probeReport';
import { captureAvatarFrames, closeupCamera, playerGroundGap } from './sceneCapture';
import { findVisualScenario, type VisualScenario } from './scenarios';

const IDLE_FRAMES = 45;
const MAX_LOAD_FRAMES = 3600;
// O lerp de posição do ator (zoneEntities.advanceActorPosition) converge em poucos frames; 30 dão folga.
const SETTLE_FRAMES = 30;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function scenarioState(scenario: VisualScenario, mapId: string, maps: Record<string, MapDefinition>): GameState {
  const base = createInitialState(mapId, maps);
  const pos = { x: scenario.x, z: scenario.z };
  const groundY = scenario.referenceGroundY ?? groundHeight(maps[mapId], pos) ?? undefined;
  return { ...base, player: { ...base.player, pos, facing: scenario.facing,
    gender: scenario.gender ?? 'male', groundY } };
}

async function buildScene(scenario: VisualScenario, container: HTMLElement): Promise<SceneManager> {
  await loadBattleTables(bundledBattleTableLoader);
  const [{ zoneMaps }, { SceneManager: Manager }] = await Promise.all([import('../data/maps_v2/runtime'), import('../engine/SceneManager')]);
  const mapId = zoneMapId(scenario.zone);
  await zoneMaps.load(mapId);
  const manager = new Manager(container);
  manager.sync(scenarioState(scenario, mapId, zoneMaps.maps), zoneMaps.maps);
  return manager;
}

async function settle(manager: SceneManager, tracker: AssetTracker): Promise<void> {
  const renderedFrame = async (): Promise<void> => { await nextFrame(); manager.render(); };
  await waitForIdleFrames(tracker, renderedFrame, IDLE_FRAMES, MAX_LOAD_FRAMES);
  for (let frame = 0; frame < SETTLE_FRAMES; frame += 1) await renderedFrame();
}

function measure(scenario: VisualScenario, view: SceneInspection, camera: THREE.Camera, tracker: AssetTracker): ProbeReport {
  const frames = captureAvatarFrames(view, camera);
  const avatar = avatarMetrics(frames);
  return {
    scenario: scenario.id,
    metrics: {
      voidRatio: voidRatio(frames.full),
      avatarVisibility: avatar.visibility,
      avatarScreenShare: avatar.screenShare,
      groundGap: playerGroundGap(view.player),
      failedAssets: tracker.failed.length,
    },
    failedAssetUrls: [...tracker.failed],
  };
}

/** Mantém o frame medido na tela sem avançar mixers, para o screenshot ser o mesmo quadro das métricas. */
function holdFrame(view: SceneInspection, camera: THREE.Camera): void {
  view.renderer.render(view.scene, camera);
  requestAnimationFrame(() => holdFrame(view, camera));
}

async function runProbe(container: HTMLElement): Promise<ProbeReport> {
  const scenario = findVisualScenario(new URLSearchParams(window.location.search).get('scenario'));
  const tracker = new AssetTracker(THREE.DefaultLoadingManager);
  const manager = await buildScene(scenario, container);
  await settle(manager, tracker);
  const view = manager.inspect();
  const camera = scenario.camera === 'closeup' ? closeupCamera(view) : view.camera;
  const report = measure(scenario, view, camera, tracker);
  holdFrame(view, camera);
  return report;
}

function publish(outcome: ProbeOutcome): void {
  window.__visualProbe = outcome;
  document.documentElement.dataset.probe = outcome.status;
}

const container = document.getElementById('app');
if (!container) throw new Error('Elemento #app não encontrado em visual.html');
runProbe(container)
  .then((report) => publish({ status: 'ready', report }))
  .catch((error: unknown) => publish({ status: 'failed', error: error instanceof Error ? error.message : String(error) }));
