import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BattleState } from '../core/battle';
import type { PokemonType } from '../data/pokemon/species';
import { createBattleArena, createBattleSlots, playBattlePokeball, replaceBattleArena, updateBattleCamera, type BattleArena } from './battleArena';
import type { GameState, MapDefinition } from '../core/types';
import { loadZoneTerrain } from './zoneTerrain';
import { buildTallGrassGroup } from './tallGrass';
import { advanceActorPosition, appendMapEntities, eventActorRoot, syncMapEntities, FACING_YAW } from './zoneEntities';
import { CharacterExpressions } from './characterExpressions';
import { preparePokemonBattleModel } from './pokemonModelSetup';
import { ContinuousTerrain } from './continuousTerrain';
import { groundedWorldPosition } from '../core/groundHeight';
import { fixOrasMaterials, picaMaterialModelUrl } from './picaMaterials';
import { NativeAnimationController } from './nativeAnimation';
import { characterModelUrl, pokemonModelUrl } from './nativeAssets';
import type { BattleEvent } from '../core/battleEvents';
import { resolveBattleSfx, resolveBcsarSfxReference, type BcsarSfxReference, type SfxCue } from '../core/battleAudio';
import { BattleEventPresenter } from './battleEventPresentation';
import { EventPresentation } from './eventPresentation';
import { followCameraPose } from './cameraFollow';
import { zoneEnvironment } from './zoneEnvironment';

export { fixOrasMaterials };

const ORAS_TILE_UNITS = 18;
const POKEMON_SCALE = 1 / 25;

export interface SceneInspection {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly player: THREE.Object3D;
  readonly terrain: THREE.Object3D;
  readonly entities: THREE.Object3D;
}

export class SceneManager {
  readonly events: EventPresentation;
  private terrainReady: Promise<void> | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private hemisphereLight: THREE.HemisphereLight;
  private directionalLight: THREE.DirectionalLight;
  private playerRoot: THREE.Group;
  private terrainGroup: THREE.Group;
  private tallGrassGroup: THREE.Group;
  private entitiesGroup: THREE.Group;
  private battleGroup: THREE.Group;
  private battleArena!: BattleArena;
  private battlePlayerSlot: THREE.Group;
  private battleEnemySlot: THREE.Group;
  private gltfLoader = new GLTFLoader();
  private continuousTerrain = new ContinuousTerrain((url) => this.gltfLoader.loadAsync(picaMaterialModelUrl(url)), fixOrasMaterials);
  private continuousRegion = '';
  private renderedZones = new Set<string>();
  private clock = new THREE.Clock();
  private playerAnim: NativeAnimationController | null = null;
  private entityActors: NativeAnimationController[] = [];
  private readonly characterExpressions = new CharacterExpressions();
  private battleActors = new Map<THREE.Group, NativeAnimationController>();
  private battleLoads: Promise<void>[] = [];
  private battleLoadVersion = 0;
  private readonly battleEventPresenter = new BattleEventPresenter({
    getVersion: () => this.battleLoadVersion,
    isCurrent: (version) => this.inBattle && version === this.battleLoadVersion,
    waitForModels: async () => { await Promise.all(this.battleLoads); },
    getArena: () => this.battleArena,
    getSlot: (side) => side === 'player' ? this.battlePlayerSlot : this.battleEnemySlot,
    playSfx: (event) => this.playSfx(resolveBattleSfx(event)),
    playNativeEvent: (slot, event) => this.battleActors.get(slot)?.playEvent(event) ?? Promise.resolve(),
  });
  private walkUntilMs = 0;
  private playerTargetPos = new THREE.Vector3();
  private lastPlayerPos = { mapId: '', x: -1, z: -1 };
  private currentMapId = '';
  private currentMapName = '';
  private environmentMapId = '';
  private mapLoadVersion = 0;
  private currentBattleKey = '';
  private currentPlayerGender: 'male' | 'female' | null = null;
  private playerLoadVersion = 0;
  private inBattle = false;

  constructor(container: HTMLElement, private readonly emitSfx: (cue: SfxCue, native?: BcsarSfxReference) => void = () => {}) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      250
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);
    container.style.backgroundColor = '#000';
    this.events = new EventPresentation(this.camera, this.renderer.domElement,
      () => ({ x: this.playerRoot.position.x, y: this.playerRoot.position.y + 0.5, z: this.playerRoot.position.z }), () => this.terrainReady,
      (map, actorId) => eventActorRoot(map, actorId, this.entitiesGroup, this.playerRoot),
      target => {
        const pose = followCameraPose(this.currentMapId, target);
        this.scene.background = new THREE.Color(pose.backgroundColor);
        return pose;
      });

    this.hemisphereLight = new THREE.HemisphereLight(0xf0f9ff, 0x365314, 1.05);
    this.scene.add(this.hemisphereLight);

    this.directionalLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    this.directionalLight.position.set(20, 35, 20);
    this.scene.add(this.directionalLight);
    this.applyZoneEnvironment('zone_0006');

    this.terrainGroup = new THREE.Group();
    this.tallGrassGroup = new THREE.Group();
    this.entitiesGroup = new THREE.Group();
    this.entitiesGroup.add(this.tallGrassGroup);
    this.scene.add(this.terrainGroup, this.entitiesGroup);

    this.playerRoot = new THREE.Group();
    const playerGeo = new THREE.CapsuleGeometry(0.35, 0.6, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: '#38bdf8' });
    const placeholder = new THREE.Mesh(playerGeo, playerMat);
    placeholder.position.y = 0.65;
    this.playerRoot.add(placeholder);
    this.scene.add(this.playerRoot);

    this.battleGroup = new THREE.Group();
    this.battleGroup.visible = false;
    const battleSlots = createBattleSlots();
    this.battlePlayerSlot = battleSlots.playerSlot;
    this.battleEnemySlot = battleSlots.enemySlot;
    this.buildBattleArena();
    this.battleGroup.add(this.battlePlayerSlot, this.battleEnemySlot);
    this.scene.add(this.battleGroup);

    window.addEventListener('resize', () => this.onResize(container));
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.onResize(container)).observe(container);
    }
  }

  private onResize(container: HTMLElement): void {
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private applyZoneEnvironment(mapId: string): void {
    const environment = zoneEnvironment(mapId);
    this.scene.background = new THREE.Color(environment.backgroundColor);
    this.scene.fog = new THREE.Fog(environment.fogColor, environment.fogNear, environment.fogFar);
    this.hemisphereLight.color.set(environment.hemisphereSkyColor);
    this.hemisphereLight.groundColor.set(environment.hemisphereGroundColor);
    this.hemisphereLight.intensity = environment.hemisphereIntensity;
    this.directionalLight.color.set(environment.directionalColor);
    this.directionalLight.intensity = environment.directionalIntensity;
  }

  private buildTerrainPlaceholder(map: MapDefinition): void {
    this.terrainGroup.clear();

    const isInterior = !map.modelUrl;
    const floorColor =
      map.id === 'brendan_house'
        ? '#d6b48c'
        : map.id === 'oldale_pokecenter'
          ? '#f8fafc'
          : isInterior
            ? '#cbd5e1'
            : '#2d5a27';
    const wallColor =
      map.id === 'oldale_pokecenter' ? '#ef4444' : isInterior ? '#94a3b8' : '#475569';

    const floorGeo = new THREE.PlaneGeometry(
      isInterior ? map.width : map.width + 24,
      isInterior ? map.height : map.height + 24
    );
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(map.width / 2 - 0.5, -0.04, map.height / 2 - 0.5);
    this.terrainGroup.add(floor);

    const blockGeo = new THREE.BoxGeometry(0.95, isInterior ? 1.4 : 0.9, 0.95);
    const blockMat = new THREE.MeshStandardMaterial({ color: wallColor });
    const grassGeo = new THREE.BoxGeometry(0.92, 0.25, 0.92);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#16a34a' });
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        if (map.collisions[z]?.[x] === 1) {
          const wall = new THREE.Mesh(blockGeo, blockMat);
          wall.position.set(x, isInterior ? 0.7 : 0.45, z);
          this.terrainGroup.add(wall);
          continue;
        }
        if (map.terrain?.[z]?.[x] === 2) {
          const grass = new THREE.Mesh(grassGeo, grassMat);
          grass.position.set(x, 0.125, z);
          this.terrainGroup.add(grass);
        }
      }
    }
  }

  private resetEntities(): void {
    this.characterExpressions.clear(this.entitiesGroup);
    this.entitiesGroup.clear();
    this.tallGrassGroup.clear();
    this.entitiesGroup.add(this.tallGrassGroup);
    for (const actor of this.entityActors) actor.dispose();
    this.entityActors = [];
    this.renderedZones.clear();
  }

  private buildEntities(map: MapDefinition, append = false, flags: Readonly<Record<number, boolean>> = {}): void {
    if (!append) this.resetEntities();
    const grass = buildTallGrassGroup(map);
    if (grass) this.tallGrassGroup.add(grass);
    appendMapEntities(map, this.entitiesGroup,
      (url, target) => this.loadCharacterModel(url, target, false, '/assets/characters/npc/npc.glb'), flags);
  }

  private syncContinuous(map: MapDefinition, maps: Record<string, MapDefinition>,
    flags: Readonly<Record<number, boolean>>): boolean {
    if (!map.continuousRegion) return false;
    if (this.continuousRegion !== map.continuousRegion) {
      this.continuousRegion = map.continuousRegion;
      this.mapLoadVersion++;
      this.continuousTerrain.reset();
      this.terrainGroup.clear();
      this.terrainGroup.add(this.continuousTerrain.root);
      this.resetEntities();
    }
    const visible = Object.values(maps).filter((zone) => zone.continuousRegion === map.continuousRegion);
    for (const zone of visible) {
      if (this.renderedZones.has(zone.id)) continue;
      this.renderedZones.add(zone.id);
      this.buildEntities(zone, true, flags);
    }
    this.terrainReady = this.continuousTerrain.sync(visible).catch((error: unknown) => console.error(`Chunks da região ${map.continuousRegion}`, error));
    this.currentMapId = map.id;
    return true;
  }

  // validacao-visual/ADR-001: o probe mede a cena de produção; duplicar o renderer validaria outra cena.
  public inspect(): SceneInspection {
    return { scene: this.scene, camera: this.camera, renderer: this.renderer,
      player: this.playerRoot, terrain: this.terrainGroup, entities: this.entitiesGroup };
  }

  public sync(state: GameState, maps: Record<string, MapDefinition>): void {
    const desiredGender = state.player.gender ?? 'male';
    if (this.currentPlayerGender !== desiredGender) {
      this.currentPlayerGender = desiredGender;
      const modelUrl =
        desiredGender === 'female'
          ? '/assets/characters/may/may.glb'
          : '/assets/characters/brendan/brendan.glb';
      this.loadCharacterModel(modelUrl, this.playerRoot, true);
    }

    const map = maps[state.player.mapId];
    if (!map) return;
    this.currentMapName = map.name;
    if (this.environmentMapId !== map.id) {
      this.environmentMapId = map.id;
      this.applyZoneEnvironment(map.id);
    }
    const flags = state.romEvents?.flags ?? {};

    const previousRegion = this.continuousRegion;
    if (!this.syncContinuous(map, maps, flags) && this.currentMapId !== map.id) {
      this.continuousRegion = '';
      this.continuousTerrain.reset();
      this.currentMapId = map.id;
      const version = ++this.mapLoadVersion;
      this.buildTerrainPlaceholder(map);
      this.buildEntities(map, false, flags);
      this.terrainReady = null;
      if (map.modelChunks?.length) {
        this.terrainReady = loadZoneTerrain(map.modelChunks, (url) => this.gltfLoader.loadAsync(picaMaterialModelUrl(url)), fixOrasMaterials)
          .then((root) => {
            if (this.mapLoadVersion !== version) return;
            this.terrainGroup.clear();
            this.terrainGroup.add(root);
          }).catch((error: unknown) => console.warn(`Terreno ${map.id} indisponível; mantendo grid`, error));
      } else if (map.modelUrl) {
        this.loadMapModels(map);
      }
    }

    const mapChanged = this.lastPlayerPos.mapId !== state.player.mapId;
    if (
      !mapChanged &&
      (this.lastPlayerPos.x !== state.player.pos.x || this.lastPlayerPos.z !== state.player.pos.z)
    ) {
      this.walkUntilMs = performance.now() + 220;
    }
    this.lastPlayerPos = {
      mapId: state.player.mapId,
      x: state.player.pos.x,
      z: state.player.pos.z,
    };

    syncMapEntities(map, this.entitiesGroup, this.characterExpressions, flags);
    this.characterExpressions.set(this.playerRoot, state.player.faceExpression);
    const target = groundedWorldPosition(state.player.pos, map, state.player.groundY);
    this.playerTargetPos.set(target.x, target.y, target.z);
    const continuous = previousRegion && previousRegion === map.continuousRegion &&
      this.playerRoot.position.distanceToSquared(this.playerTargetPos) < 2.5;
    if (mapChanged && !continuous) this.playerRoot.position.copy(this.playerTargetPos);
    this.playerRoot.rotation.y = FACING_YAW[state.player.facing];

    if (!this.inBattle) this.events.follow();
  }

  public syncBattle(battle: BattleState | null): void {
    const active = battle !== null;
    this.inBattle = active;
    this.terrainGroup.visible = !active;
    this.tallGrassGroup.visible = !active;
    this.entitiesGroup.visible = !active;
    this.playerRoot.visible = !active;
    this.battleGroup.visible = active;

    if (!battle) {
      this.currentBattleKey = '';
      this.clearBattleAnimations();
      this.battleArena.cameraMotion.cancel();
      return;
    }

    this.battleArena = replaceBattleArena(this.battleGroup, this.battleArena, this.currentMapName, this.currentMapId);
    updateBattleCamera(this.camera, this.clock.elapsedTime, this.battleArena.cameraMotion);

    const key = `${battle.playerActive}:${battle.enemyActive}:${battle.player.species.id}:${battle.enemy.species.id}`;
    if (this.currentBattleKey === key) return;
    this.currentBattleKey = key;
    this.clearBattleAnimations();
    this.battleLoads = [this.loadPokemonModel(battle.player.species.id, this.battlePlayerSlot),
      this.loadPokemonModel(battle.enemy.species.id, this.battleEnemySlot)];
  }

  private clearBattleAnimations(): void {
    this.battleLoadVersion++;
    this.battleEventPresenter.clear();
    for (const actor of this.battleActors.values()) actor.dispose();
    this.battleActors.clear();
    this.battleLoads = [];
  }
  public playBattleEvents(events: readonly BattleEvent[], enemyMoveType: PokemonType = 'normal'): Promise<void> {
    return this.battleEventPresenter.play(events, enemyMoveType);
  }

  private buildBattleArena(): void {
    this.battleArena = createBattleArena();
    this.battleGroup.add(this.battleArena.group);
  }

  public playAttackEffect(type: PokemonType, attacker: 'player' | 'enemy' = 'player'): void {
    if (!this.inBattle) return;
    this.battleEventPresenter.queueAttack(type, attacker);
  }

  public playPokeballEffect(captured = false, shakes = captured ? 3 : 1): void {
    if (!this.inBattle) return;
    this.playSfx(resolveBattleSfx({ type: 'pokeball', captured }));
    playBattlePokeball(this.battleArena, this.battlePlayerSlot, this.battleEnemySlot, captured, shakes);
  }

  public playSfx(cue: SfxCue | null): void { if (cue) this.emitSfx(cue, resolveBcsarSfxReference(cue)); }

  private loadCharacterModel(url: string, target: THREE.Group, isPlayer = false, fallbackUrl?: string): void {
    const version = isPlayer ? ++this.playerLoadVersion : 0;
    this.gltfLoader.load(
      picaMaterialModelUrl(characterModelUrl(url)),
      (gltf) => {
        if (isPlayer ? version !== this.playerLoadVersion : target.parent !== this.entitiesGroup) return;
        const model = gltf.scene;
        model.scale.setScalar(1 / ORAS_TILE_UNITS);
        fixOrasMaterials(model);
        this.characterExpressions.bind(target, model, characterModelUrl(url));
        target.clear();
        target.add(model);

        if (gltf.animations.length === 0) return;
        const actor = new NativeAnimationController(new THREE.AnimationMixer(model), gltf.animations);
        actor.mixer.update(0);
        if (isPlayer) {
          this.playerAnim?.dispose();
          this.playerAnim = actor;
        } else {
          this.entityActors.push(actor);
        }
      },
      undefined,
      () => {
        if (fallbackUrl && fallbackUrl !== url && target.parent === this.entitiesGroup) {
          this.loadCharacterModel(fallbackUrl, target);
        }
        // Mantém placeholder geométrico caso o .glb não exista localmente.
      }
    );
  }

  private loadPokemonModel(speciesId: string, target: THREE.Group): Promise<void> {
    target.clear();
    const version = this.battleLoadVersion;
    return this.gltfLoader.loadAsync(pokemonModelUrl(speciesId)).then((gltf) => {
      if (!this.inBattle || version !== this.battleLoadVersion) return;
      const model = gltf.scene;
      model.scale.setScalar(POKEMON_SCALE);
      const expressionPlayer = preparePokemonBattleModel(model, speciesId);
      target.clear();
      target.add(model);
      const mixer = new THREE.AnimationMixer(model);
      this.battleActors.set(target, new NativeAnimationController(mixer, gltf.animations, expressionPlayer ?? undefined));
      mixer.update(0);
    }).catch((error: unknown) => {
      if (!this.inBattle || version !== this.battleLoadVersion) return;
      console.warn(`Pokémon asset unavailable: ${speciesId}`, error);
      const fallback = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
        new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
      fallback.position.y = 0.5;
      target.add(fallback);
    });
  }

  private loadMapModels(map: MapDefinition): void {
    if (!map.modelUrl) return;
    const expectedMapId = map.id;
    this.gltfLoader.load(
      picaMaterialModelUrl(map.modelUrl),
      (gltf) => {
        if (this.currentMapId !== expectedMapId) return;
        const model = gltf.scene;
        model.scale.setScalar(1 / ORAS_TILE_UNITS);
        model.position.set(map.width / 2 - 0.5, 0, map.height / 2 - 0.5);
        fixOrasMaterials(model);

        this.terrainGroup.clear();
        const baseFloor = new THREE.Mesh(
          new THREE.PlaneGeometry(map.width + 40, map.height + 40),
          new THREE.MeshStandardMaterial({ color: '#2d5a27' })
        );
        baseFloor.rotation.x = -Math.PI / 2;
        baseFloor.position.set(map.width / 2 - 0.5, -0.08, map.height / 2 - 0.5);
        this.terrainGroup.add(baseFloor, model);

        if (map.propsUrl) {
          this.gltfLoader.load(map.propsUrl, (propsGltf) => {
            if (this.currentMapId !== expectedMapId) return;
            const propsModel = propsGltf.scene;
            propsModel.scale.setScalar(1 / ORAS_TILE_UNITS);
            propsModel.position.set(map.width / 2 - 0.5, 0, map.height / 2 - 0.5);
            fixOrasMaterials(propsModel);
            this.terrainGroup.add(propsModel);
          });
        }
      },
      undefined,
      () => {
        // Mantém placeholder geométrico caso o .glb não esteja disponível localmente.
      }
    );
  }

  private updatePlayerAnimation(): void {
    if (!this.playerAnim) return;
    const isMoving =
      this.playerRoot.position.distanceToSquared(this.playerTargetPos) > 0.002 ||
      performance.now() < this.walkUntilMs;
    this.playerAnim.setMoving(isMoving);
  }

  public render(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (!this.inBattle) {
      advanceActorPosition(this.playerRoot, this.playerTargetPos, dt);
      this.updatePlayerAnimation();
      this.playerAnim?.mixer.update(dt);
      for (const actor of this.entityActors) actor.mixer.update(dt);
    } else {
      updateBattleCamera(this.camera, this.clock.elapsedTime, this.battleArena.cameraMotion, dt);
      for (const actor of this.battleActors.values()) actor.update(dt);
      this.battleArena.effects.update(dt);
    }
    if (!this.inBattle) this.events.tick();
    this.renderer.render(this.scene, this.camera);
  }
}
