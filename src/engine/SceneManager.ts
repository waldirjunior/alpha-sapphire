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

function fixOrasMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.side = THREE.DoubleSide;
        mat.roughness = 0.92;
        mat.metalness = 0.0;
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.alphaTest = 0.45;
          mat.transparent = false;
        }
        mat.needsUpdate = true;
      }
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
  private battlePlayerSlot: THREE.Group;
  private battleEnemySlot: THREE.Group;
  private gltfLoader = new GLTFLoader();
  private currentMapId = '';
  private currentBattleKey = '';
  private inBattle = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#7dd3fc');

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
    container.appendChild(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x3f6212, 0.95);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.15);
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
    this.loadCharacterModel('/assets/characters/brendan/brendan.glb', this.playerRoot);

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

  private buildTerrainPlaceholder(map: MapDefinition): void {
    this.terrainGroup.clear();

    const floorGeo = new THREE.PlaneGeometry(map.width + 24, map.height + 24);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#2d5a27' });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(map.width / 2 - 0.5, -0.04, map.height / 2 - 0.5);
    this.terrainGroup.add(floor);

    const blockGeo = new THREE.BoxGeometry(0.95, 0.9, 0.95);
    const blockMat = new THREE.MeshStandardMaterial({ color: '#475569' });
    const grassGeo = new THREE.BoxGeometry(0.92, 0.25, 0.92);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#16a34a' });
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        if (map.collisions[z]?.[x] === 1) {
          const wall = new THREE.Mesh(blockGeo, blockMat);
          wall.position.set(x, 0.45, z);
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

  private buildEntities(map: MapDefinition): void {
    this.entitiesGroup.clear();

    const warpGeo = new THREE.BoxGeometry(0.88, 0.06, 0.88);
    const warpMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', transparent: true, opacity: 0.75 });
    for (const warp of map.warps) {
      const marker = new THREE.Mesh(warpGeo, warpMat);
      marker.position.set(warp.from.x, 0.03, warp.from.z);
      this.entitiesGroup.add(marker);
    }

    if (!map.interactables?.length) return;
    const postGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);
    const boardGeo = new THREE.BoxGeometry(0.7, 0.45, 0.12);
    const woodMat = new THREE.MeshStandardMaterial({ color: '#92400e' });
    const boardMat = new THREE.MeshStandardMaterial({ color: '#fef3c7' });

    for (const item of map.interactables) {
      if (item.kind === 'sign') {
        const signGroup = new THREE.Group();
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.y = 0.27;
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.y = 0.65;
        signGroup.add(post, board);
        signGroup.position.set(item.pos.x, 0, item.pos.z);
        this.entitiesGroup.add(signGroup);
        continue;
      }

      const npcGroup = new THREE.Group();
      npcGroup.position.set(item.pos.x, 0, item.pos.z);
      const fallback = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
        new THREE.MeshStandardMaterial({ color: '#f43f5e' })
      );
      fallback.position.y = 0.55;
      npcGroup.add(fallback);
      this.entitiesGroup.add(npcGroup);

      const modelPath =
        item.npcModel === 'may'
          ? '/assets/characters/may/may.glb'
          : '/assets/characters/npc/npc.glb';
      this.loadCharacterModel(modelPath, npcGroup);
    }
  }

  public sync(state: GameState, maps: Record<string, MapDefinition>): void {
    const map = maps[state.player.mapId];
    if (!map) return;

    if (this.currentMapId !== map.id) {
      this.currentMapId = map.id;
      this.buildTerrainPlaceholder(map);
      this.buildEntities(map);
      if (map.modelUrl) {
        this.loadMapModels(map);
      }
    }

    this.playerRoot.position.x = state.player.pos.x;
    this.playerRoot.position.z = state.player.pos.z;
    this.playerRoot.rotation.y = FACING_YAW[state.player.facing];

    if (!this.inBattle) {
      this.camera.position.set(state.player.pos.x, 9, state.player.pos.z + 8);
      this.camera.lookAt(state.player.pos.x, 0.5, state.player.pos.z);
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

  private loadCharacterModel(url: string, target: THREE.Group): void {
    this.gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(1 / ORAS_TILE_UNITS);
        fixOrasMaterials(model);
        target.clear();
        target.add(model);
      },
      undefined,
      () => {
        // Mantém placeholder geométrico caso o .glb não exista localmente.
      }
    );
  }

  private loadPokemonModel(speciesId: string, target: THREE.Group): void {
    target.clear();
    this.gltfLoader.load(
      `/assets/pokemon/${speciesId}/${speciesId}.glb`,
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(POKEMON_SCALE);
        fixOrasMaterials(model);
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

  public render(): void {
    if (!this.inBattle) {
      this.playerRoot.position.y = Math.sin(performance.now() * 0.005) * 0.03;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
