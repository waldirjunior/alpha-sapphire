import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyDefaultPokemonExpressions } from './pokemonModelExpressions';

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
});
