import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BattleState } from '../core/battle';
import type { Direction, GameState, MapDefinition } from '../core/types';

const ORAS_TILE_UNITS = 18;
const POKEMON_SCALE = 1 / 25;
const FACING_YAW: Record<Direction, number> = {
  down: 0,
  up: Math.PI,
  right: Math.PI / 2,
  left: -Math.PI / 2,
};

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private playerRoot: THREE.Group;
  private mapGroup: THREE.Group;
  private battleGroup: THREE.Group;
  private battlePlayerSlot: THREE.Group;
  private battleEnemySlot: THREE.Group;
  private gltfLoader = new GLTFLoader();
  private currentMapId = '';
  private currentBattleKey = '';
  private inBattle = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f172a');

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(10, 20, 10);
    this.scene.add(sun);

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    this.playerRoot = new THREE.Group();
    const playerGeo = new THREE.CapsuleGeometry(0.35, 0.6, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: '#38bdf8' });
    const placeholder = new THREE.Mesh(playerGeo, playerMat);
    placeholder.position.y = 0.65;
    this.playerRoot.add(placeholder);
    this.scene.add(this.playerRoot);
    this.loadPlayerModel();

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
  }

  private onResize(container: HTMLElement): void {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private buildMapPlaceholder(map: MapDefinition): void {
    this.mapGroup.clear();

    const floorGeo = new THREE.PlaneGeometry(map.width, map.height);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#1e3a2f' });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(map.width / 2 - 0.5, 0, map.height / 2 - 0.5);
    this.mapGroup.add(floor);

    const grid = new THREE.GridHelper(
      Math.max(map.width, map.height),
      Math.max(map.width, map.height),
      0x334155,
      0x1e293b
    );
    grid.position.set(map.width / 2 - 0.5, 0.01, map.height / 2 - 0.5);
    this.mapGroup.add(grid);

    const blockGeo = new THREE.BoxGeometry(0.95, 0.9, 0.95);
    const blockMat = new THREE.MeshStandardMaterial({ color: '#475569' });
    const grassGeo = new THREE.BoxGeometry(0.92, 0.25, 0.92);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#16a34a' });
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        if (map.collisions[z]?.[x] === 1) {
          const wall = new THREE.Mesh(blockGeo, blockMat);
          wall.position.set(x, 0.45, z);
          this.mapGroup.add(wall);
          continue;
        }
        if (map.terrain?.[z]?.[x] === 2) {
          const grass = new THREE.Mesh(grassGeo, grassMat);
          grass.position.set(x, 0.125, z);
          this.mapGroup.add(grass);
        }
      }
    }

    const warpGeo = new THREE.BoxGeometry(0.9, 0.1, 0.9);
    const warpMat = new THREE.MeshStandardMaterial({ color: '#f59e0b' });
    for (const warp of map.warps) {
      const marker = new THREE.Mesh(warpGeo, warpMat);
      marker.position.set(warp.from.x, 0.05, warp.from.z);
      this.mapGroup.add(marker);
    }

    if (map.interactables?.length) {
      const signGeo = new THREE.BoxGeometry(0.55, 0.7, 0.55);
      const signMat = new THREE.MeshStandardMaterial({ color: '#eab308' });
      const npcGeo = new THREE.CapsuleGeometry(0.32, 0.5, 4, 8);
      const npcMat = new THREE.MeshStandardMaterial({ color: '#f43f5e' });
      for (const item of map.interactables) {
        const isNpc = item.kind === 'npc';
        const mesh = new THREE.Mesh(isNpc ? npcGeo : signGeo, isNpc ? npcMat : signMat);
        mesh.position.set(item.pos.x, isNpc ? 0.57 : 0.35, item.pos.z);
        this.mapGroup.add(mesh);
      }
    }
  }

  public sync(state: GameState, maps: Record<string, MapDefinition>): void {
    const map = maps[state.player.mapId];
    if (!map) return;

    if (this.currentMapId !== map.id) {
      this.currentMapId = map.id;
      this.buildMapPlaceholder(map);
      if (map.modelUrl) {
        this.loadMapModel(map);
      }
    }

    this.playerRoot.position.x = state.player.pos.x;
    this.playerRoot.position.z = state.player.pos.z;
    this.playerRoot.rotation.y = FACING_YAW[state.player.facing];

    if (!this.inBattle) {
      // Câmera inclinada estilo ORAS
      this.camera.position.set(
        state.player.pos.x,
        9,
        state.player.pos.z + 8
      );
      this.camera.lookAt(state.player.pos.x, 0.5, state.player.pos.z);
    }
  }

  public syncBattle(battle: BattleState | null): void {
    const active = battle !== null;
    this.inBattle = active;
    this.mapGroup.visible = !active;
    this.playerRoot.visible = !active;
    this.battleGroup.visible = active;

    if (!battle) {
      this.currentBattleKey = '';
      return;
    }

    this.camera.position.set(-3.6, 2.5, 4.4);
    this.camera.lookAt(0.4, 0.8, -0.4);

    const key = `${battle.player.species.id}:${battle.enemy.species.id}`;
    if (this.currentBattleKey === key) return;
    this.currentBattleKey = key;

    this.loadPokemonModel(battle.player.species.id, this.battlePlayerSlot);
    this.loadPokemonModel(battle.enemy.species.id, this.battleEnemySlot);
  }

  private buildBattleArena(): void {
    const groundGeo = new THREE.CircleGeometry(6.5, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#166534' });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.battleGroup.add(ground);

    const padGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.12, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: '#4ade80' });
    const playerPad = new THREE.Mesh(padGeo, padMat);
    playerPad.position.set(-1.6, 0.06, 1.4);
    const enemyPad = new THREE.Mesh(padGeo, padMat);
    enemyPad.position.set(1.6, 0.06, -1.4);
    this.battleGroup.add(playerPad, enemyPad);
  }

  private loadPokemonModel(speciesId: string, target: THREE.Group): void {
    target.clear();
    this.gltfLoader.load(
      `/assets/pokemon/${speciesId}/${speciesId}.glb`,
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(POKEMON_SCALE);
        target.clear();
        target.add(model);
      },
      undefined,
      () => {
        const fallback = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 16, 12),
          new THREE.MeshStandardMaterial({ color: '#f59e0b' })
        );
        fallback.position.y = 0.5;
        target.add(fallback);
      }
    );
  }

  private loadPlayerModel(): void {
    this.gltfLoader.load(
      '/assets/characters/brendan/brendan.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(1 / ORAS_TILE_UNITS);
        this.playerRoot.clear();
        this.playerRoot.add(model);
      },
      undefined,
      () => {
        // Mantém cápsula placeholder caso o .glb do protagonista não exista localmente.
      }
    );
  }

  private loadMapModel(map: MapDefinition): void {
    if (!map.modelUrl) return;
    const expectedMapId = map.id;
    this.gltfLoader.load(
      map.modelUrl,
      (gltf) => {
        if (this.currentMapId !== expectedMapId) return;
        const model = gltf.scene;
        const scale = 1 / ORAS_TILE_UNITS;
        model.scale.setScalar(scale);
        model.position.set(map.width / 2 - 0.5, 0, map.height / 2 - 0.5);
        this.mapGroup.clear();
        this.mapGroup.add(model);
      },
      undefined,
      () => {
        // Mantém placeholder geométrico caso o .glb não esteja disponível localmente.
      }
    );
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
