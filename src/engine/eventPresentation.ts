import type { PerspectiveCamera } from 'three';
import type { AmxEffect } from '../core/amxTypes';
import type { MapDefinition } from '../core/types';
import { EventCamera, type EventCameraPose } from './eventCamera';
import { followCameraPose, type CameraPoint, type FollowCameraPose } from './cameraFollow';
import { EventFade } from './eventFade';
import { EventTurns, type EventActorContext, type EventActorRoot } from './eventTurns';

export class EventPresentation {
  private readonly motion: EventCamera;
  private readonly fade: EventFade;
  private readonly turns: EventTurns;
  private readonly gameFov: number;
  private pose: EventCameraPose | null = null;

  constructor(private readonly camera: PerspectiveCamera, canvas: { style: { opacity: string } },
    private readonly followTarget: () => EventCameraPose['target'], private readonly terrainReady: () => Promise<void> | null,
    actorRoot?: EventActorRoot,
    private readonly cameraFollow: (target: CameraPoint) => FollowCameraPose = target => followCameraPose('', target)) {
    this.gameFov = camera.fov;
    this.motion = new EventCamera(() => this.pose ?? { eye: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: followTarget(), fov: camera.fov, roll: 0 }, pose => this.projectPose(pose));
    this.fade = new EventFade(opacity => { canvas.style.opacity = String(opacity); });
    this.turns = new EventTurns((map, actorId) => actorRoot?.(map, actorId));
  }

  follow(): void {
    if (this.motion.active) return;
    const pose = this.cameraFollow(this.followTarget());
    this.camera.position.set(pose.eye.x, pose.eye.y, pose.eye.z);
    this.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  }

  get cameraActive(): boolean { return this.motion.active; }
  tick(): void { this.turns.tick(); this.follow(); this.motion.tick(); this.fade.tick(); }
  directions(): Readonly<Record<number, number>> { return this.turns.directions(); }

  reset(): void {
    this.motion.reset();
    this.fade.reset();
    this.turns.reset();
    this.pose = null;
    this.camera.fov = this.gameFov;
    this.camera.up.set(0, 1, 0);
    this.camera.updateProjectionMatrix();
  }

  async request(effect: AmxEffect, map: MapDefinition, active: () => boolean, context?: EventActorContext): Promise<number | undefined> {
    if (!active()) return undefined;
    if (effect.name === '_FieldMapBlockIsLoading') {
      const ready = this.terrainReady();
      if (!ready) return undefined;
      await ready;
      return active() ? 0 : undefined;
    }
    if (effect.channel === 'camera') {
      const value = this.motion.request(effect, map);
      if (value !== undefined && effect.name === 'EVCameraBegin') console.warn('Câmera AMX: interpolação eye/target em ticks de render; sem paridade FPS/quaternion da ROM (P-013)');
      return value;
    }
    if (effect.channel === 'movement' && context) {
      const value = this.turns.request(effect, map, context);
      if (value !== undefined && effect.name === 'MdlAcmdSetEnd') console.warn('ACMD AMX: giro de yaw no host sem clipe GF1 nativo ou paridade de FPS (P-013)');
      return value;
    }
    if (effect.channel === 'fade') return this.fade.request(effect);
    return undefined;
  }

  private projectPose(pose: EventCameraPose): void {
    this.pose = pose;
    this.camera.position.set(pose.eye.x, pose.eye.y, pose.eye.z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    this.camera.fov = pose.fov;
    this.camera.updateProjectionMatrix();
  }
}
