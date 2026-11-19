import { describe, expect, it } from 'vitest';
import { createInitialState } from '../core/gameState';
import { completeIntro, confirmPlayerDetails, defaultPlayerName } from './intro';

describe('game intro helpers', () => {
  it('chooses the original protagonist name for each gender', () => {
    expect(defaultPlayerName('male')).toBe('Brendan');
    expect(defaultPlayerName('female')).toBe('May');
  });

  it('confirms a trimmed name and finishes the truck arrival at the start map', () => {
    const initial = createInitialState('littleroot_town');
    const named = confirmPlayerDetails(initial, 'female', '  May  ');
    expect(named.player).toMatchObject({ gender: 'female', playerName: 'May' });

    const arrived = completeIntro(named, 'littleroot_town', { x: 8, z: 9 });
    expect(arrived.player).toMatchObject({
      mapId: 'littleroot_town',
      pos: { x: 8, z: 9 },
      facing: 'up',
    });
    expect(arrived.storyFlags.intro_completed).toBe(true);
    expect(arrived.activeDialogue?.sourceId).toBe('mom_arrival');
    expect(arrived.activeDialogue?.text).toContain('May');
  });
});
