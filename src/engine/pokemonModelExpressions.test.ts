import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyDefaultPokemonExpressions, bindPokemonBattleExpressions } from './pokemonModelExpressions';
import { preparePokemonBattleModel } from './pokemonModelSetup';

describe('default Pokémon expressions', () => {
  it('hides every open-mouth variant when a closed-mouth mesh exists', () => {
    const model = new THREE.Group();
    const closeMouth = new THREE.Group();
    closeMouth.name = 'pm0255_00_CloseMouthSkin';
    const openMouth = new THREE.Group();
    openMouth.name = 'pm0255_00_OpenMouthSkin';
    const secondaryOpenMouth = new THREE.Mesh();
    secondaryOpenMouth.name = 'pm0255_00_OpenMouthSkin_8_0';
    const eye = new THREE.Mesh();
    eye.name = 'pm0255_00_Eye';
    model.add(closeMouth, openMouth, secondaryOpenMouth, eye);

    applyDefaultPokemonExpressions(model);

    expect(closeMouth.visible).toBe(true);
    expect(openMouth.visible).toBe(false);
    expect(secondaryOpenMouth.visible).toBe(false);
    expect(eye.visible).toBe(true);
  });

  it('keeps an open mouth visible when the model has no closed-mouth variant', () => {
    const model = new THREE.Group();
    const openMouth = new THREE.Mesh();
    openMouth.name = 'pm0001_00_OpenMouthSkin';
    model.add(openMouth);

    applyDefaultPokemonExpressions(model);

    expect(openMouth.visible).toBe(true);
  });

  it('plays native mouth visibility and eye UV frames with the battle clip clock', () => {
    const model = new THREE.Group();
    const closedMouth = new THREE.Group();
    closedMouth.name = 'pm0255_00_CloseMouthSkin';
    const openMouth = new THREE.Group();
    openMouth.name = 'pm0255_00_OpenMouthSkin';
    const eyeTexture = new THREE.Texture();
    const eye = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: eyeTexture }));
    eye.material.name = 'Eye';
    model.add(closedMouth, openMouth, eye);
    applyDefaultPokemonExpressions(model);
    const expressions = bindPokemonBattleExpressions(model, {
      fps: 30,
      eyeBaseTranslation: [1, 0],
      actions: {
        idle: {
          meshVisibility: { pm0255_00_CloseMouthSkin: [{ frame: 0, visible: true }], pm0255_00_OpenMouthSkin: [{ frame: 0, visible: false }] },
          eyeTranslations: [{ frame: 0, x: 1, y: 0 }],
        },
        physical: {
          meshVisibility: {
            pm0255_00_CloseMouthSkin: [{ frame: 0, visible: true }, { frame: 1, visible: false }],
            pm0255_00_OpenMouthSkin: [{ frame: 0, visible: false }, { frame: 1, visible: true }],
          },
          eyeTranslations: [{ frame: 0, x: 1, y: 0 }, { frame: 1, x: 0.75, y: 0.5 }],
        },
      },
    });

    expressions.update('idle', 0);
    expressions.update('physical', 1 / 30);

    expect(closedMouth.visible).toBe(false);
    expect(openMouth.visible).toBe(true);
    expect(eyeTexture.offset.toArray()).toEqual([0.25, 0.5]);

    expressions.update('idle', 0);
    expect(closedMouth.visible).toBe(true);
    expect(openMouth.visible).toBe(false);
    expect(eyeTexture.offset.toArray()).toEqual([0, 0]);
    expressions.dispose();
  });

  it('applies the extracted Torchic attack curves to matching GLB nodes and Eye texture', () => {
    const model = new THREE.Group();
    const closedMouth = new THREE.Group();
    closedMouth.name = 'pm0255_00_CloseMouthSkin';
    const openMouth = new THREE.Group();
    openMouth.name = 'pm0255_00_OpenMouthSkin';
    const eyeTexture = new THREE.Texture();
    const eyeMaterial = new THREE.MeshStandardMaterial({ map: eyeTexture });
    eyeMaterial.name = 'Eye';
    model.add(closedMouth, openMouth, new THREE.Mesh(new THREE.BoxGeometry(), eyeMaterial));

    const expressions = preparePokemonBattleModel(model, 'torchic');
    expect(expressions).not.toBeNull();
    expressions?.update('physical', 29 / 30);

    expect(closedMouth.visible).toBe(false);
    expect(openMouth.visible).toBe(true);
    expect(eyeTexture.offset.toArray()).toEqual([0.5, 0]);
    expressions?.dispose();
  });
});
