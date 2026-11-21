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

  it('plays extracted curves for ROM eye materials and Pidove wing meshes', () => {
    const cases = [
      { slug: 'gothita', frame: 1, names: ['LEye', 'REye'], offset: [0.5, 0] },
      { slug: 'lillipup', frame: 3, names: ['LEye', 'REye', 'Mouth'], offset: [0.5, 0] },
      { slug: 'pidove', frame: 5, names: ['LEye', 'REye'], offset: [0, 0.25] },
      { slug: 'shellos', frame: 21, names: ['AEye'], offset: [0, 0.25] },
      { slug: 'swampert', frame: 17, names: ['Eye00', 'Eye01'], offset: [0, 0.25] },
    ] as const;

    for (const entry of cases) {
      const model = new THREE.Group();
      const textures = new Map<string, THREE.Texture>();
      for (const name of entry.names) {
        const texture = new THREE.Texture();
        const material = new THREE.MeshBasicMaterial({ map: texture });
        material.name = name;
        textures.set(name, texture);
        model.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
      }
      if (entry.slug === 'pidove') {
        for (const name of ['pm0519_00_LCloseWingSkin', 'pm0519_00_LWingSkin', 'pm0519_00_RCloseWingSkin', 'pm0519_00_RWingSkin']) {
          const wing = new THREE.Mesh();
          wing.name = name;
          model.add(wing);
        }
      }

      const expressions = preparePokemonBattleModel(model, entry.slug);
      expect(expressions, entry.slug).not.toBeNull();
      expressions?.update('physical', entry.frame / 30);
      for (const name of entry.names.filter(name => name.toLowerCase().includes('eye'))) {
        expect(textures.get(name)?.offset.toArray(), `${entry.slug}/${name}`).toEqual(entry.offset);
      }
      if (entry.slug === 'lillipup') {
        expect(textures.get('Mouth')?.offset.toArray()).toEqual([0.5, 0.25]);
      }
      if (entry.slug === 'pidove') {
        expressions?.update('special', 5 / 30);
        expect(model.getObjectByName('pm0519_00_LCloseWingSkin')?.visible).toBe(false);
        expect(model.getObjectByName('pm0519_00_LWingSkin')?.visible).toBe(true);
      }
      expressions?.dispose();
    }
  });
});
