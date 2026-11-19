import { describe, expect, it } from 'vitest';
import { zoneEnvironment } from './zoneEnvironment';

describe('environment lighting by map', () => {
  it('keeps Hoenn outdoor sky and uses balanced daylight lighting', () => {
    expect(zoneEnvironment('zone_0006')).toMatchObject({
      backgroundColor: '#7dd3fc',
      fogColor: '#93c5fd',
      hemisphereIntensity: 0.78,
      directionalIntensity: 0.72,
    });
  });

  it('uses a dark, cool environment for Rusturf Tunnel', () => {
    expect(zoneEnvironment('zone_0075')).toMatchObject({
      backgroundColor: '#18221d',
      fogColor: '#324135',
      fogNear: 18,
      fogFar: 66,
      hemisphereIntensity: 1,
      directionalIntensity: 0.8,
    });
  });

  it('keeps Meteor Falls warm and brightly lit while removing the outdoor sky', () => {
    expect(zoneEnvironment('zone_0071')).toMatchObject({
      backgroundColor: '#17130d',
      fogColor: '#75613e',
      hemisphereSkyColor: '#fff0bd',
      directionalColor: '#ffe39a',
      directionalIntensity: 1.15,
    });
  });

  it('gives registered interiors a neutral enclosed background and soft light', () => {
    expect(zoneEnvironment('brendan_house')).toMatchObject({
      backgroundColor: '#151515',
      fogColor: '#332e27',
      hemisphereIntensity: 0.72,
      directionalIntensity: 0.22,
    });
  });
});
