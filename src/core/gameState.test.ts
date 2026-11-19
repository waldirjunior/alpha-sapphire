import { describe, expect, it } from 'vitest';
import { MAPS as EXTRACTED_MAPS } from '../data/maps';
import {
  createInitialState,
  findTriggeredTrainer,
  interact,
  isTallGrass,
  isWalkable,
  movePlayer,
} from './gameState';
import type { MapDefinition } from './types';

const TEST_MAPS: Record<string, MapDefinition> = {
  littleroot_town: {
    id: 'littleroot_town',
    name: 'Littleroot Town',
    width: 10,
    height: 10,
    collisions: Array.from({ length: 10 }, (_, z) =>
      Array.from({ length: 10 }, (_, x) => (x === 0 || z === 0 ? 1 : 0))
    ),
    warps: [
      {
        from: { x: 5, z: 1 },
        targetMapId: 'route_101',
        targetPos: { x: 5, z: 8 },
      },
    ],
  },
  route_101: {
    id: 'route_101',
    name: 'Route 101',
    width: 10,
    height: 10,
    collisions: Array.from({ length: 10 }, () => Array(10).fill(0)),
    warps: [],
  },
};

describe('gameState', () => {
  it('moves player on walkable tiles and respects collisions', () => {
    let state = createInitialState();
    state = movePlayer(state, 'right', TEST_MAPS);
    expect(state.player.pos).toEqual({ x: 6, z: 5 });

    // Move to blocked border x=0
    state.player.pos = { x: 1, z: 5 };
    state = movePlayer(state, 'left', TEST_MAPS);
    expect(state.player.pos).toEqual({ x: 1, z: 5 });
    expect(state.player.facing).toBe('left');
  });

  it('keeps the observed Surf water code blocked on foot despite its raw GR collision value', () => {
    const waterMap = { ...TEST_MAPS.littleroot_town, surfTiles: [{ x: 6, z: 5 }] };
    const maps = { ...TEST_MAPS, littleroot_town: waterMap };
    const state = createInitialState('littleroot_town', maps);

    expect(waterMap.collisions[5][6]).toBe(0);
    expect(isWalkable(waterMap, { x: 6, z: 5 })).toBe(false);
    expect(movePlayer(state, 'right', maps).player.pos).toEqual({ x: 5, z: 5 });
  });

  it('triggers warp transition between maps', () => {
    const state = createInitialState();
    state.player.pos = { x: 5, z: 2 };
    const next = movePlayer(state, 'up', TEST_MAPS);
    expect(next.player.mapId).toBe('route_101');
    expect(next.player.pos).toEqual({ x: 5, z: 8 });
  });

  it('carries the selected bridge floor across movement and follows a continuous ramp height', () => {
    const layeredMap: MapDefinition = {
      id: 'layered', name: 'Layered', width: 4, height: 4,
      collisions: Array.from({ length: 4 }, () => Array(4).fill(0)), warps: [],
      groundHeights: Array.from({ length: 4 }, () => Array(4).fill(0)),
      groundHeightCandidates: [
        { x: 2, z: 1, heights: [0, 7.5] },
        { x: 3, z: 1, heights: [0, 7.25] },
      ],
    };
    const start = createInitialState('layered', { layered: layeredMap });
    const high = movePlayer({ ...start, player: { ...start.player, pos: { x: 1, z: 1 }, groundY: 7.5 } }, 'right', { layered: layeredMap });
    const ramp = movePlayer(high, 'right', { layered: layeredMap });
    expect(high.player.groundY).toBe(7.5);
    expect(ramp.player.groundY).toBe(7.25);
  });

  it('uses the incoming actor height when a warp lands on a layered interior floor', () => {
    const outside: MapDefinition = {
      id: 'outside', name: 'Outside', width: 4, height: 4,
      collisions: Array.from({ length: 4 }, () => Array(4).fill(0)),
      warps: [{ from: { x: 1, z: 1 }, targetMapId: 'interior', targetPos: { x: 2, z: 2 } }],
      groundHeights: Array.from({ length: 4 }, () => Array(4).fill(0)),
    };
    const interior: MapDefinition = {
      id: 'interior', name: 'Interior', width: 4, height: 4,
      collisions: Array.from({ length: 4 }, () => Array(4).fill(0)), warps: [],
      groundHeights: Array.from({ length: 4 }, () => Array(4).fill(0)),
      groundHeightCandidates: [{ x: 2, z: 2, heights: [0, 7.5] }],
    };
    const initial = createInitialState('outside', { outside, interior });
    const start = { ...initial, player: { ...initial.player, pos: { x: 1, z: 2 }, groundY: 7.4 } };
    const arrived = movePlayer(start, 'up', { outside, interior });
    expect(arrived.player.mapId).toBe('interior');
    expect(arrived.player.groundY).toBe(7.5);
  });

  it('uses map spawnPos and traverses extracted 40x40 Hoenn maps', () => {
    let state = createInitialState('littleroot_town', EXTRACTED_MAPS);
    expect(state.player.pos).toEqual({ x: 20, z: 14 });

    // Walk north from (20, 1) to warp at (20, 0) -> Route 101 (20, 38)
    state = {
      ...state,
      player: { ...state.player, pos: { x: 20, z: 1 } },
    };
    state = movePlayer(state, 'up', EXTRACTED_MAPS);
    expect(state.player.mapId).toBe('route_101');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });

    // Detect tall grass tile extracted from GR 0005
    expect(isTallGrass(EXTRACTED_MAPS.route_101, { x: 12, z: 25 })).toBe(true);
    expect(isTallGrass(EXTRACTED_MAPS.littleroot_town, { x: 20, z: 14 })).toBe(false);
  });

  it('opens and closes dialogue when interacting with a sign and pauses movement', () => {
    const mapsWithSign: Record<string, MapDefinition> = {
      ...TEST_MAPS,
      littleroot_town: {
        ...TEST_MAPS.littleroot_town,
        interactables: [
          {
            id: 'town_sign',
            pos: { x: 5, z: 4 },
            kind: 'sign',
            text: 'Littleroot Town',
            setFlag: 'read_town_sign',
          },
        ],
      },
    };

    let state = createInitialState();
    state = {
      ...state,
      player: { ...state.player, pos: { x: 5, z: 5 }, facing: 'up' },
    };

    state = interact(state, mapsWithSign);
    expect(state.activeDialogue).toEqual({
      sourceId: 'town_sign',
      text: 'Littleroot Town',
    });
    expect(state.storyFlags.read_town_sign).toBe(true);

    // Movement is paused while dialogue is active
    const duringDialogue = movePlayer(state, 'right', mapsWithSign);
    expect(duringDialogue.player.pos).toEqual({ x: 5, z: 5 });

    // Second interact closes dialogue
    state = interact(state, mapsWithSign);
    expect(state.activeDialogue).toBeUndefined();
  });

  it('blocks warp with requiredFlag until flag is set and supports altText on interactables', () => {
    const gatedMaps: Record<string, MapDefinition> = {
      littleroot_town: {
        ...TEST_MAPS.littleroot_town,
        warps: [
          {
            from: { x: 5, z: 1 },
            targetMapId: 'route_101',
            targetPos: { x: 5, z: 8 },
            requiredFlag: 'starter_chosen',
            blockedMessage: 'Você precisa escolher um Pokémon antes de sair!',
          },
        ],
        interactables: [
          {
            id: 'birch_aide',
            pos: { x: 6, z: 5 },
            kind: 'npc',
            text: 'Fale com o Prof. Birch primeiro!',
            requiredFlag: 'starter_chosen',
            altText: 'Boa sorte na sua jornada por Hoenn!',
          },
        ],
      },
      route_101: TEST_MAPS.route_101,
    };

    let state = createInitialState();
    state = { ...state, player: { ...state.player, pos: { x: 5, z: 2 }, facing: 'up' } };

    // Blocked without flag
    const blocked = movePlayer(state, 'up', gatedMaps);
    expect(blocked.player.mapId).toBe('littleroot_town');
    expect(blocked.activeDialogue?.text).toContain('escolher um Pokémon');

    // Before flag: NPC shows default text
    const preNpc = interact({ ...state, player: { ...state.player, pos: { x: 5, z: 5 }, facing: 'right' } }, gatedMaps);
    expect(preNpc.activeDialogue?.text).toBe('Fale com o Prof. Birch primeiro!');

    // After flag: NPC shows altText and warp succeeds
    state = { ...state, storyFlags: { ...state.storyFlags, starter_chosen: true } };
    const postNpc = interact({ ...state, player: { ...state.player, pos: { x: 5, z: 5 }, facing: 'right' } }, gatedMaps);
    expect(postNpc.activeDialogue?.text).toBe('Boa sorte na sua jornada por Hoenn!');

    const warped = movePlayer(state, 'up', gatedMaps);
    expect(warped.player.mapId).toBe('route_101');
  });

  it('detects undefeated trainer line of sight blocked by walls and ignores after defeat', () => {
    const trainerMaps: Record<string, MapDefinition> = {
      route_102: {
        id: 'route_102',
        name: 'Route 102',
        width: 10,
        height: 10,
        collisions: Array.from({ length: 10 }, (_, z) =>
          Array.from({ length: 10 }, (_, x) => (x === 4 && z === 5 ? 1 : 0))
        ),
        warps: [],
        interactables: [
          {
            id: 'trainer_calvin',
            pos: { x: 6, z: 5 },
            kind: 'npc',
            facing: 'left',
            sightRange: 3,
            text: 'Calvin: Hora da batalha!',
            trainer: { name: 'Youngster Calvin', speciesId: 'poochyena', level: 5 },
          },
        ],
      },
    };

    // Blocked by wall at (4,5) when player is at (3,5)
    let state = createInitialState('route_102', trainerMaps);
    state = { ...state, player: { ...state.player, pos: { x: 3, z: 5 } } };
    expect(findTriggeredTrainer(state, trainerMaps)).toBeNull();

    // Clear line of sight at (5,5)
    state = { ...state, player: { ...state.player, pos: { x: 5, z: 5 } } };
    expect(findTriggeredTrainer(state, trainerMaps)?.id).toBe('trainer_calvin');

    // Ignored after trainer is marked defeated
    state = { ...state, storyFlags: { ...state.storyFlags, 'defeated_trainer:trainer_calvin': true } };
    expect(findTriggeredTrainer(state, trainerMaps)).toBeNull();
  });

  it('enters and exits Littleroot and Oldale building interiors through open door tiles', () => {
    // Enter brendan_house at (14, 11) from (14, 12)
    let state = createInitialState('littleroot_town', EXTRACTED_MAPS);
    state = { ...state, player: { ...state.player, pos: { x: 14, z: 12 }, facing: 'up' } };
    state = movePlayer(state, 'up', EXTRACTED_MAPS);
    expect(state.player.mapId).toBe('brendan_house');

    // Exit brendan_house back to littleroot_town
    state = { ...state, player: { ...state.player, pos: { x: 16, z: 17 }, facing: 'down' } };
    state = movePlayer(state, 'down', EXTRACTED_MAPS);
    expect(state.player.mapId).toBe('littleroot_town');

    // Enter birch_lab at (16, 23) from (16, 24)
    state = { ...state, player: { ...state.player, pos: { x: 16, z: 24 }, facing: 'up' } };
    state = movePlayer(state, 'up', EXTRACTED_MAPS);
    expect(state.player.mapId).toBe('birch_lab');

    // Enter oldale_pokecenter at (13, 15) from (13, 16)
    state = createInitialState('oldale_town', EXTRACTED_MAPS);
    state = { ...state, player: { ...state.player, pos: { x: 13, z: 16 }, facing: 'up' } };
    state = movePlayer(state, 'up', EXTRACTED_MAPS);
    expect(state.player.mapId).toBe('oldale_pokecenter');
  });
});
