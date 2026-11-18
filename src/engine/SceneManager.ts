import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BattleState } from '../core/battle';
import type { PokemonType } from '../data/pokemon/species';
import { createBattleArena, type BattleArena } from './battleArena';
import type { GameState, MapDefinition } from '../core/types';
import { loadZoneTerrain } from './zoneTerrain';
import { appendMapEntities, syncMapEntities, FACING_YAW } from './zoneEntities';
import { CharacterExpressions } from './characterExpressions';
import { ContinuousTerrain } from './continuousTerrain';
import { worldPosition } from '../core/boundaries';
import { NativeAnimationController, characterClip, type CharacterAnimController } from './nativeAnimation';
import { characterModelUrl, pokemonModelUrl } from './nativeAssets';
import type { BattleEvent } from '../core/battleEvents';

const ORAS_TILE_UNITS = 18;
const POKEMON_SCALE = 1 / 25;

// P-007: .glb de mapas gerados por convert_gr_to_glb.py trazem `extras.pica` e o
// alphaMode/alphaCutoff derivados do BlendFunction/AlphaTest do PICA200. Nesse caso o
// GLTFLoader já configurou transparência e recorte; só falta impedir depthWrite em BLEND.
function applyPicaAlphaState(mat: THREE.MeshStandardMaterial): void {
  if (mat.transparent) mat.depthWrite = false;
}

// Modelos sem metadado PICA (personagens, Pokémon) mantêm a heurística anterior.
function applyLegacyAlphaState(mat: THREE.MeshStandardMaterial): void {
  if (!mat.map) return;
  if (/kage|shadow/i.test(mat.name)) {
    mat.transparent = true;
    mat.alphaTest = 0.02;
    mat.depthWrite = false;
    return;
  }
  mat.alphaTest = 0.45;
  mat.transparent = false;
}

export function fixOrasMaterials(root: THREE.Object3D, preserveGltfAlpha = false): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      mat.side = THREE.DoubleSide;
      mat.roughness = 0.92;
      mat.metalness = 0.0;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (preserveGltfAlpha || mat.userData.pica === true) applyPicaAlphaState(mat);
      else applyLegacyAlphaState(mat);
      mat.needsUpdate = true;
    }
  });
}

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private playerRoot: THREE.Group;
  private terrainGroup: THREE.Group;
  private entitiesGroup: THREE.Group;
  private battleGroup: THREE.Group;
  private battleArena!: BattleArena;
  private battlePlayerSlot: THREE.Group;
  private battleEnemySlot: THREE.Group;
  private gltfLoader = new GLTFLoader();
  private continuousTerrain = new ContinuousTerrain((url) => this.gltfLoader.loadAsync(url), fixOrasMaterials);
  private continuousRegion = '';
  private renderedZones = new Set<string>();
  private clock = new THREE.Clock();
  private playerAnim: CharacterAnimController | null = null;
  private entityMixers: THREE.AnimationMixer[] = [];
  private readonly characterExpressions = new CharacterExpressions();
  private battleActors = new Map<THREE.Group, NativeAnimationController>();
  private battleLoads: Promise<void>[] = [];
  private battleLoadVersion = 0;
  private walkUntilMs = 0;
  private playerTargetPos = new THREE.Vector3();
  private lastPlayerPos = { mapId: '', x: -1, z: -1 };
  private currentMapId = '';
  private mapLoadVersion = 0;
  private currentBattleKey = '';
  private currentPlayerGender: 'male' | 'female' = 'male';
  private inBattle = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7dd3fc');
    this.scene.fog = new THREE.Fog('#93c5fd', 32, 95);

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

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x365314, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sun.position.set(20, 35, 20);
    this.scene.add(sun);

    this.terrainGroup = new THREE.Group();
    this.entitiesGroup = new THREE.Group();
    this.scene.add(this.terrainGroup, this.entitiesGroup);

    this.playerRoot = new THREE.Group();
    const playerGeo = new THREE.CapsuleGeometry(0.35, 0.6, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: '#38bdf8' });
    const placeholder = new THREE.Mesh(playerGeo, playerMat);
    placeholder.position.y = 0.65;
    this.playerRoot.add(placeholder);
    this.scene.add(this.playerRoot);
    this.loadCharacterModel('/assets/characters/brendan/brendan.glb', this.playerRoot, true);

    this.battleGroup = new THREE.Group();
    this.battleGroup.visible = false;
    this.battlePlayerSlot = new THREE.Group();
    this.battlePlayerSlot.position.set(-1.6, 0, 1.4);
    this.battlePlayerSlot.rotation.y = Math.PI * 0.75;
    this.battleEnemySlot = new THREE.Group();
    this.battleEnemySlot.position.set(1.6, 0, -1.4);
    this.battleEnemySlot.rotation.y = -Math.PI * 0.25;
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
    for (const mixer of this.entityMixers) mixer.stopAllAction();
    this.entityMixers = [];
    this.renderedZones.clear();
  }

  private buildEntities(map: MapDefinition, append = false): void {
    if (!append) this.resetEntities();
    appendMapEntities(map, this.entitiesGroup,
      (url, target) => this.loadCharacterModel(url, target, false, '/assets/characters/npc/npc.glb'));
  }

  private syncContinuous(map: MapDefinition, maps: Record<string, MapDefinition>): boolean {
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
      this.buildEntities(zone, true);
    }
    void this.continuousTerrain.sync(visible).catch((error: unknown) => console.error(`Chunks da região ${map.continuousRegion}`, error));
    this.currentMapId = map.id;
    return true;
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

    const previousRegion = this.continuousRegion;
    if (!this.syncContinuous(map, maps) && this.currentMapId !== map.id) {
      this.continuousRegion = '';
      this.continuousTerrain.reset();
      this.currentMapId = map.id;
      const version = ++this.mapLoadVersion;
      this.buildTerrainPlaceholder(map);
      this.buildEntities(map);
      if (map.modelChunks?.length) {
        void loadZoneTerrain(map.modelChunks, (url) => this.gltfLoader.loadAsync(url), fixOrasMaterials)
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

    syncMapEntities(map, this.entitiesGroup, this.characterExpressions);
    this.characterExpressions.set(this.playerRoot, state.player.faceExpression);
    const target = worldPosition(state.player.pos, map);
    this.playerTargetPos.set(target.x, 0, target.z);
    const continuous = previousRegion && previousRegion === map.continuousRegion &&
      this.playerRoot.position.distanceToSquared(this.playerTargetPos) < 2.5;
    if (mapChanged && !continuous) this.playerRoot.position.copy(this.playerTargetPos);
    this.playerRoot.rotation.y = FACING_YAW[state.player.facing];

    if (!this.inBattle) {
      this.camera.position.set(this.playerRoot.position.x, 9, this.playerRoot.position.z + 8);
      this.camera.lookAt(this.playerRoot.position.x, 0.5, this.playerRoot.position.z);
    }
  }

  public syncBattle(battle: BattleState | null): void {
    const active = battle !== null;
    this.inBattle = active;
    this.terrainGroup.visible = !active;
    this.entitiesGroup.visible = !active;
    this.playerRoot.visible = !active;
    this.battleGroup.visible = active;

    if (!battle) {
      this.currentBattleKey = '';
      this.clearBattleAnimations();
      return;
    }

    this.camera.position.set(-3.6, 2.5, 4.4);
    this.camera.lookAt(0.4, 0.8, -0.4);

    const key = `${battle.playerActive}:${battle.enemyActive}:${battle.player.species.id}:${battle.enemy.species.id}`;
    if (this.currentBattleKey === key) return;
    this.currentBattleKey = key;
    this.clearBattleAnimations();
    this.battleLoads = [this.loadPokemonModel(battle.player.species.id, this.battlePlayerSlot),
      this.loadPokemonModel(battle.enemy.species.id, this.battleEnemySlot)];
  }

  private clearBattleAnimations(): void {
    this.battleLoadVersion++;
    for (const actor of this.battleActors.values()) actor.dispose();
    this.battleActors.clear();
    this.battleLoads = [];
  }

  public async playBattleEvents(events: readonly BattleEvent[]): Promise<void> {
    const version = this.battleLoadVersion;
    await Promise.all(this.battleLoads);
    for (const event of events) {
      if (!this.inBattle || version !== this.battleLoadVersion) return;
      const slot = event.side === 'player' ? this.battlePlayerSlot : this.battleEnemySlot;
      await this.battleActors.get(slot)?.playEvent(event);
    }
  }

  private buildBattleArena(): void {
    this.battleArena = createBattleArena();
    this.battleGroup.add(this.battleArena.group);
  }

  public playAttackEffect(type: PokemonType): void {
    if (!this.inBattle) return;
    const from = this.battlePlayerSlot.position.clone().setY(1);
    const to = this.battleEnemySlot.position.clone().setY(1);
    this.battleArena.effects.play(type, from, to);
  }

  private loadCharacterModel(url: string, target: THREE.Group, isPlayer = false, fallbackUrl?: string): void {
    this.gltfLoader.load(
      characterModelUrl(url),
      (gltf) => {
        if (!isPlayer && target.parent !== this.entitiesGroup) return;
        const model = gltf.scene;
        model.scale.setScalar(1 / ORAS_TILE_UNITS);
        fixOrasMaterials(model);
        this.characterExpressions.bind(target, model, characterModelUrl(url));
        target.clear();
        target.add(model);

        if (gltf.animations.length === 0) return;
        const mixer = new THREE.AnimationMixer(model);
        const idleClip = characterClip(gltf.animations, false);
        const walkClip = characterClip(gltf.animations, true);
        const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
        const walkAction = walkClip ? mixer.clipAction(walkClip) : null;

        if (idleAction) {
          idleAction.play();
          mixer.update(0);
        }

        if (isPlayer) {
          this.playerAnim = { mixer, idle: idleAction, walk: walkAction, active: 'idle' };
        } else {
          this.entityMixers.push(mixer);
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
      fixOrasMaterials(model, true);
      target.clear();
      target.add(model);
      const mixer = new THREE.AnimationMixer(model);
      this.battleActors.set(target, new NativeAnimationController(mixer, gltf.animations));
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
      map.modelUrl,
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
    const shouldWalk = isMoving && this.playerAnim.walk !== null;
    const nextState: 'idle' | 'walk' = shouldWalk ? 'walk' : 'idle';
    if (this.playerAnim.active === nextState) return;

    const current = this.playerAnim.active === 'walk' ? this.playerAnim.walk : this.playerAnim.idle;
    const target = nextState === 'walk' ? this.playerAnim.walk : this.playerAnim.idle;
    current?.fadeOut(0.15);
    target?.reset().fadeIn(0.15).play();
    this.playerAnim.active = nextState;
  }

  public render(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (!this.inBattle) {
      this.playerRoot.position.x = THREE.MathUtils.damp(
        this.playerRoot.position.x,
        this.playerTargetPos.x,
        18,
        dt
      );
      this.playerRoot.position.z = THREE.MathUtils.damp(
        this.playerRoot.position.z,
        this.playerTargetPos.z,
        18,
        dt
      );
      this.camera.position.set(this.playerRoot.position.x, 9, this.playerRoot.position.z + 8);
      this.camera.lookAt(this.playerRoot.position.x, 0.5, this.playerRoot.position.z);

      this.updatePlayerAnimation();
      this.playerAnim?.mixer.update(dt);
      for (const mixer of this.entityMixers) {
        mixer.update(dt);
      }
    } else {
      for (const actor of this.battleActors.values()) actor.mixer.update(dt);
      this.battleArena.effects.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
