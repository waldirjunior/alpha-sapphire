import { expect, test } from '@playwright/test';
import { trackPageErrors } from './support/pageErrors';

const ROM_ARENA_CASES = [
  { biome: 'grass', mapId: 'zone_0023' },
  { biome: 'water', mapId: 'zone_0032' },
  { biome: 'cave', mapId: 'zone_0078' },
  { biome: 'gym', mapId: 'zone_0441' },
  { biome: 'indoor', mapId: 'zone_0286' },
] as const;

test('arenas ROM de todos os biomas carregam suas camadas e ocultam piso/plataformas procedurais', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');

  for (const { biome, mapId } of ROM_ARENA_CASES) {
    const modelRequest = page.waitForResponse(response =>
      response.url().endsWith(`/assets/battle-arenas/${biome}/${biome}.glb`) && response.status() === 200);
    const stageRequest = biome === 'indoor' ? null : page.waitForResponse(response =>
      response.url().endsWith(`/assets/battle-arenas/${biome}/stage/stage.glb`) && response.status() === 200);
    const textureRequest = page.waitForResponse(response =>
      response.url().includes(`/assets/battle-arenas/${biome}/`) && response.url().endsWith('.png') && response.status() === 200);
    const torchicRequest = page.waitForResponse(response =>
      response.url().includes('/assets/native/pokemon/torchic-') && response.status() === 200);
    const poochyenaRequest = page.waitForResponse(response =>
      response.url().includes('/assets/native/pokemon/poochyena-') && response.status() === 200);
    const result = await page.evaluate(async (targetMapId) => {
      const { getZoneMap } = await import('/src/data/maps_v2/loader.ts');
      const { createPokemonInstance, startWildBattle } = await import('/src/core/battle.ts');
      const { SPECIES } = await import('/src/data/pokemon/species.ts');
      const { SceneManager } = await import('/src/engine/SceneManager.ts');
      const sourceMap = await getZoneMap(targetMapId);
      const map = targetMapId === 'zone_0286' ? { ...sourceMap, name: 'Pokémon Center' } : sourceMap;
      const container = document.createElement('div');
      container.id = 'battle-arena-capture';
      container.style.width = '800px';
      container.style.height = '480px';
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.zIndex = '999999';
      document.body.append(container);

      const manager = new SceneManager(container);
      manager.sync({
        player: { id: 'player', mapId: targetMapId, pos: map.spawnPos ?? { x: 1, z: 1 }, facing: 'down' },
        storyFlags: {},
      }, { [targetMapId]: map });
      const battle = startWildBattle(
        [createPokemonInstance(SPECIES.torchic, 5)],
        createPokemonInstance(SPECIES.poochyena, 3),
      );
      manager.syncBattle(battle);

      const scene = manager.inspect().scene;
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 15_000;
        const waitForArena = (): void => {
          const hasStage = targetMapId === 'zone_0286' || scene.getObjectByName('battle-rom-arena-stage');
          const hasPokemon = scene.getObjectByName('pm0255_00') && scene.getObjectByName('pm0261_00');
          if (scene.getObjectByName('battle-rom-arena-model') && hasStage && hasPokemon) {
            resolve();
            return;
          }
          if (Date.now() >= deadline) {
            reject(new Error(`Modelo ROM da arena não carregou em ${targetMapId}`));
            return;
          }
          window.setTimeout(waitForArena, 25);
        };
        waitForArena();
      });

      manager.render();
      return {
        mapName: map.name,
        romModelAttached: Boolean(scene.getObjectByName('battle-rom-arena-model')),
        romStageAttached: Boolean(scene.getObjectByName('battle-rom-arena-stage')),
        proceduralFallbackVisible: scene.getObjectByName('battle-procedural-fallback')?.visible === true,
        proceduralGroundVisible: scene.getObjectByName('battle-ground')?.visible === true,
        proceduralPlatformVisible: scene.getObjectByName('battle-platform-top')?.visible === true,
      };
    }, mapId);

    expect((await torchicRequest).status()).toBe(200);
    expect((await poochyenaRequest).status()).toBe(200);
    expect((await modelRequest).status()).toBe(200);
    if (stageRequest) expect((await stageRequest).status()).toBe(200);
    expect((await textureRequest).status()).toBe(200);
    expect(result.romModelAttached).toBe(true);
    expect(result.romStageAttached).toBe(biome !== 'indoor');
    expect(result.proceduralFallbackVisible).toBe(false);
    expect(result.proceduralGroundVisible).toBe(false);
    expect(result.proceduralPlatformVisible).toBe(false);
    expect(result.mapName).toBeTruthy();
    await page.locator('#battle-arena-capture canvas').screenshot({ path: `/tmp/battle-arena-${biome}.png` });
    await page.locator('#battle-arena-capture canvas').evaluate((canvas) => {
      const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.parentElement?.remove();
    });
  }

  expect(errors).toEqual([]);
});
