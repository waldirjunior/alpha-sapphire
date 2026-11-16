import * as THREE from 'three';
import type { GameState, MapDefinition } from '../core/types';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private playerMesh: THREE.Mesh;
  private mapGroup: THREE.Group;
  private currentMapId = '';

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

    // Placeholder do protagonista (será substituído pelo .glb extraído da ROM)
    const playerGeo = new THREE.CapsuleGeometry(0.35, 0.6, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: '#38bdf8' });
    this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
    this.playerMesh.position.y = 0.65;
    this.scene.add(this.playerMesh);

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
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        if (map.collisions[z]?.[x] === 1) {
          const wall = new THREE.Mesh(blockGeo, blockMat);
          wall.position.set(x, 0.45, z);
          this.mapGroup.add(wall);
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
  }

  public sync(state: GameState, maps: Record<string, MapDefinition>): void {
    const map = maps[state.player.mapId];
    if (!map) return;

    if (this.currentMapId !== map.id) {
      this.currentMapId = map.id;
      this.buildMapPlaceholder(map);
    }

    this.playerMesh.position.x = state.player.pos.x;
    this.playerMesh.position.z = state.player.pos.z;

    // Câmera inclinada estilo ORAS
    this.camera.position.set(
      state.player.pos.x,
      9,
      state.player.pos.z + 8
    );
    this.camera.lookAt(state.player.pos.x, 0.5, state.player.pos.z);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
