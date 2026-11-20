import type { Object3D } from 'three';

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
