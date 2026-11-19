import { describe, expect, it } from 'vitest';
import { directionForKey } from './input';

describe('game input mapping', () => {
  it('maps arrows and WASD to the same grid directions', () => {
    expect(directionForKey('ArrowUp')).toBe('up');
    expect(directionForKey('KeyW')).toBe('up');
    expect(directionForKey('ArrowLeft')).toBe('left');
    expect(directionForKey('KeyD')).toBe('right');
  });

  it('ignores keys that do not move the player', () => {
    expect(directionForKey('Space')).toBeNull();
    expect(directionForKey('Escape')).toBeNull();
  });
});
