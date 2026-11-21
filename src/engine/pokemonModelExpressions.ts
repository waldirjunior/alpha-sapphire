import { Mesh, Texture, Vector2, type Material, type Object3D } from 'three';

export interface PokemonExpressionVisibilityKey { readonly frame: number; readonly visible: boolean; }
export interface PokemonExpressionTextureKey { readonly frame: number; readonly x: number; readonly y: number; }

export interface PokemonBattleExpressionAction {
  readonly eyeTranslations?: readonly PokemonExpressionTextureKey[];
  readonly materialTranslations?: Readonly<Record<string, readonly PokemonExpressionTextureKey[]>>;
  readonly meshVisibility?: Readonly<Record<string, readonly PokemonExpressionVisibilityKey[]>>;
}

export interface PokemonBattleExpressionProfile {
  readonly fps: number;
  readonly eyeBaseTranslation?: readonly number[];
  readonly materialBaseTranslations?: Readonly<Record<string, readonly number[]>>;
  readonly actions: Readonly<Record<string, PokemonBattleExpressionAction>>;
}

export interface PokemonBattleExpressionController {
  update(clip: string, elapsedSeconds: number): void;
  dispose(): void;
}

interface VisibilityBinding {
  readonly node: Object3D;
  readonly framesByClip: Readonly<Record<string, readonly PokemonExpressionVisibilityKey[]>>;
  readonly defaultVisible: boolean;
}

interface TextureBinding {
  readonly texture: Texture;
  readonly defaultOffset: Vector2;
  readonly materialName: string;
  readonly baseTranslation: readonly number[];
}

export function applyDefaultPokemonExpressions(root: Object3D): void {
  let hasClosedMouth = false;
  const openMouthVariants: Object3D[] = [];
  root.traverse(node => {
    const name = node.name.toLowerCase();
    hasClosedMouth ||= name.includes('closemouth');
    if (name.includes('openmouth')) openMouthVariants.push(node);
  });
  if (!hasClosedMouth) return;
  for (const variant of openMouthVariants) variant.visible = false;
}

export function bindPokemonBattleExpressions(
  root: Object3D,
  profile: PokemonBattleExpressionProfile,
): PokemonBattleExpressionController {
  const visibility = bindVisibility(root, profile);
  const textures = bindMaterialTextures(root, profile);
  return {
    update: (clip, elapsedSeconds) => updateExpressionFrame(clip, elapsedSeconds, profile, visibility, textures),
    dispose: () => restoreExpressionDefaults(visibility, textures),
  };
}

function bindVisibility(root: Object3D, profile: PokemonBattleExpressionProfile): VisibilityBinding[] {
  const framesByName = new Map<string, Record<string, readonly PokemonExpressionVisibilityKey[]>>();
  for (const [clip, action] of Object.entries(profile.actions)) {
    for (const [name, frames] of Object.entries(action.meshVisibility ?? {})) {
      const framesByClip = framesByName.get(name) ?? {};
      framesByClip[clip] = frames;
      framesByName.set(name, framesByClip);
    }
  }
  const nodes = new Map<string, Object3D>();
  root.traverse(node => { if (framesByName.has(node.name)) nodes.set(node.name, node); });
  return [...framesByName].flatMap(([name, framesByClip]) => {
    const node = nodes.get(name);
    return node ? [{ node, framesByClip, defaultVisible: node.visible }] : [];
  });
}

function bindMaterialTextures(root: Object3D, profile: PokemonBattleExpressionProfile): TextureBinding[] {
  const baseTranslations = new Map<string, readonly number[]>();
  if (profile.eyeBaseTranslation) baseTranslations.set('Eye', profile.eyeBaseTranslation);
  for (const [name, translation] of Object.entries(profile.materialBaseTranslations ?? {})) {
    baseTranslations.set(name, translation);
  }
  const bindings: TextureBinding[] = [];
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const baseTranslation = baseTranslations.get(material.name);
      if (!baseTranslation || !hasMaterialCurve(profile, material.name)) continue;
      const texture = eyeTexture(material);
      if (texture) bindings.push({ texture, defaultOffset: texture.offset.clone(), materialName: material.name, baseTranslation });
    }
  });
  return bindings;
}

function hasMaterialCurve(profile: PokemonBattleExpressionProfile, name: string): boolean {
  return Object.values(profile.actions).some(action => name === 'Eye'
    ? Boolean(action.eyeTranslations?.length)
    : Boolean(action.materialTranslations?.[name]?.length));
}

function eyeTexture(material: Material): Texture | undefined {
  return 'map' in material && material.map instanceof Texture ? material.map : undefined;
}

function updateExpressionFrame(
  clip: string,
  elapsedSeconds: number,
  profile: PokemonBattleExpressionProfile,
  visibility: readonly VisibilityBinding[],
  textures: readonly TextureBinding[],
): void {
  restoreExpressionDefaults(visibility, textures);
  const action = profile.actions[clip];
  if (!action) return;
  const frame = Math.floor(Math.max(0, elapsedSeconds) * profile.fps);
  for (const binding of visibility) {
    const keys = binding.framesByClip[clip];
    if (keys?.length) binding.node.visible = keyAt(keys, frame).visible;
  }
  for (const binding of textures) {
    const keys = binding.materialName === 'Eye'
      ? action.eyeTranslations
      : action.materialTranslations?.[binding.materialName];
    const translation = keys?.length ? keyAt(keys, frame) : undefined;
    if (!translation) continue;
    const offsetX = binding.baseTranslation[0] - translation.x;
    const offsetY = translation.y - binding.baseTranslation[1];
    binding.texture.offset.set(offsetX, offsetY);
  }
}

function keyAt<T extends { readonly frame: number }>(keys: readonly T[], frame: number): T {
  let selected = keys[0];
  for (const key of keys) {
    if (key.frame > frame) break;
    selected = key;
  }
  return selected;
}

function restoreExpressionDefaults(
  visibility: readonly VisibilityBinding[],
  textures: readonly TextureBinding[],
): void {
  for (const binding of visibility) binding.node.visible = binding.defaultVisible;
  for (const binding of textures) binding.texture.offset.copy(binding.defaultOffset);
}
