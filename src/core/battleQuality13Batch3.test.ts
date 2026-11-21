import { describe, expect, it } from 'vitest';
import { calculateDamage, createPokemonInstance, executeBattleTurn, startWildBattle } from './battle';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { pokemonTypes, prepareBattleEntry, toBattleMove, type PokemonInstance } from './battlePokemon';
import { switchPlayerIn } from './battleParty';
import { orderActions } from './battleTurn';
import moveData from '../data/battle/moves.json';
import { advanceVolatileTurn } from './statusConditions';

const fixed = (value = 0) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));

function pokemon(species: string, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(species), 30, moves.map((name) => getMoveByName(name).id));
}

const REMAINING_QUALITY_13 = [
  'Wish', 'Future Sight', 'Doom Desire', 'Healing Wish', 'Lunar Dance',
  'Power Split', 'Guard Split', 'Stockpile', 'Acupressure', 'Flower Shield',
  'Gastro Acid', 'Worry Seed', 'Simple Beam', 'Entrainment', 'Role Play', 'Skill Swap',
  'Soak', 'Reflect Type', 'Trick-or-Treat', 'Forest’s Curse', 'Conversion', 'Conversion 2', 'Camouflage',
  'Electrify', 'Powder', 'Recycle', 'Imprison', 'Grudge', 'Snatch', 'Magic Coat', 'Psycho Shift',
  'Copycat', 'Mirror Move', 'Mimic', 'Metronome', 'Assist', 'Nature Power', 'Transform', 'Sketch',
  'Follow Me', 'Rage Powder', 'Helping Hand', 'After You', 'Ally Switch', 'Quash',
] as const;

describe('quality 13 batch 3: remaining ROM moves', () => {
  it('has an explicit non-placeholder handler for every remaining quality 13 move', () => {
    const qualityMoves = moveData.filter((entry) => entry.quality === 13);
    expect(qualityMoves).toHaveLength(90);
    expect(REMAINING_QUALITY_13).toHaveLength(45);
    const names = qualityMoves.map((entry) => entry.name);
    const user = { ...pokemon('torchic', ...names, 'Tackle'), lastMoveId: getMoveByName('Tackle').id };
    const target = { ...pokemon('wurmple', 'Tackle', 'Splash'), lastMoveId: getMoveByName('Tackle').id,
      lastHitByMoveId: getMoveByName('Tackle').id, heldItem: null };
    const context = {
      biome: 'grass' as const,
      userParty: [user, pokemon('treecko', 'Tackle')],
      targetParty: [target],
      userActiveIndex: 0,
      targetActiveIndex: 0,
      lastMoveUsedId: getMoveByName('Tackle').id,
      delayedAttackPending: false,
      userHasMoved: false,
      targetHasMoved: false,
    };
    for (const name of names) {
      const outcome = executeMove(user, target, move(name), fixed(), context);
      expect(outcome.messages.join(' '), name).not.toContain('ainda não é simulado');
    }
  });

  it('schedules Wish and delayed attacks on a side, surviving a switch until resolution', () => {
    const wisher = { ...pokemon('torchic', 'Wish', 'Tackle'), speed: 999, currentHp: 1 };
    const reserve = { ...pokemon('treecko', 'Tackle'), currentHp: 1 };
    const foe = pokemon('wurmple', 'Splash');
    let battle = startWildBattle([wisher, reserve], foe);
    battle = executeBattleTurn(battle, 0, fixed(0.99));
    expect(battle.pendingWish?.player?.healAmount).toBe(Math.floor(wisher.maxHp / 2));
    battle = switchPlayerIn(battle, 1);
    battle = executeBattleTurn(battle, 0, fixed(0.99));
    expect(battle.pendingWish?.player).toBeUndefined();
    expect(battle.player.currentHp).toBe(1 + Math.floor(wisher.maxHp / 2));

    const seer = { ...pokemon('torchic', 'Future Sight', 'Splash'), speed: 999 };
    let delayed = executeBattleTurn(startWildBattle(seer, pokemon('wurmple', 'Splash')), 0, fixed(0.99));
    expect(delayed.delayedAttacks?.enemy).toBeDefined();
    const before = delayed.enemy.currentHp;
    expect(executeMove(seer, delayed.enemy, move('Future Sight'), fixed(), { delayedAttackPending: true }).messages.at(-1)).toBe('Mas não teve efeito!');
    delayed = executeBattleTurn(delayed, 1, fixed(0.99));
    delayed = executeBattleTurn(delayed, 1, fixed(0.99));
    delayed = executeBattleTurn(delayed, 1, fixed(0.99));
    expect(delayed.enemy.currentHp).toBeLessThan(before);
  });

  it('applies stat splits, Stockpile tracking, and Acupressure to a non-maxed stage', () => {
    const user = { ...pokemon('torchic', 'Power Split', 'Guard Split', 'Stockpile', 'Acupressure'), attack: 100, spAtk: 80, defense: 40, spDef: 60 };
    const target = { ...pokemon('wurmple', 'Splash'), attack: 50, spAtk: 60, defense: 100, spDef: 80 };
    const power = executeMove(user, target, move('Power Split'), fixed());
    expect(power.user.attack).toBe(75);
    expect(power.target.spAtk).toBe(70);
    const guard = executeMove(user, target, move('Guard Split'), fixed());
    expect(guard.user.defense).toBe(70);
    expect(guard.target.spDef).toBe(70);
    const stocked = executeMove(user, target, move('Stockpile'), fixed());
    expect(stocked.user.volatile.stockpileCount).toBe(1);
    expect(stocked.user.stages).toMatchObject({ def: 1, spd: 1 });
    const raised = executeMove({ ...user, stages: { ...user.stages, atk: 6 } }, target, move('Acupressure'), fixed());
    expect(raised.user.stages.atk).toBe(6);
    expect(Object.values(raised.user.stages).some((stage) => stage === 2)).toBe(true);
    const capped = { ...user, stages: { atk: 6, def: 6, spa: 6, spd: 6, spe: 6, accuracy: 6, evasion: 6 } };
    expect(executeMove(capped, target, move('Acupressure'), fixed()).messages.at(-1)).toBe('Mas não teve efeito!');
    const grass = pokemon('treecko', 'Splash');
    const flower = executeMove(user, grass, move('Flower Shield'), fixed());
    expect(flower.target.stages.def).toBe(1);
    expect(executeMove(user, target, move('Flower Shield'), fixed()).messages.at(-1)).toBe('Mas não teve efeito!');
  });

  it('changes active ability and type, then resets temporary changes on switch', () => {
    const user = pokemon('torchic', 'Skill Swap', 'Role Play', 'Gastro Acid', 'Soak', 'Trick-or-Treat', 'Reflect Type');
    const target = pokemon('wurmple', 'Splash');
    const suppressed = executeMove(user, target, move('Gastro Acid'), fixed()).target;
    expect(suppressed.abilitySuppressed).toBe(true);
    const soaked = executeMove(user, target, move('Soak'), fixed()).target;
    expect(pokemonTypes(soaked)).toEqual(['water']);
    expect(soaked.species.types).toEqual(['water']);
    const electricHit = calculateDamage(user, soaked, { ...move('Tackle'), type: 'electric' }, fixed(0.99));
    const normalHit = calculateDamage(user, target, { ...move('Tackle'), type: 'electric' }, fixed(0.99));
    expect(electricHit).toBeGreaterThan(normalHit);
    const ghosted = executeMove(user, target, move('Trick-or-Treat'), fixed()).target;
    expect(ghosted.typesOverride).toContain('ghost');
    const swapped = executeMove(user, target, move('Skill Swap'), fixed());
    expect(swapped.user.ability).toBe(target.ability);
    expect(swapped.target.ability).toBe(user.ability);
    expect(prepareBattleEntry(swapped.user).ability).toBe(user.ability);
    expect(prepareBattleEntry(soaked).typesOverride).toBeUndefined();

    const sleeper = { ...target, status: { kind: 'sleep' as const, counter: 2 } };
    expect(executeMove(user, sleeper, move('Worry Seed'), fixed()).target.status).toBeNull();
    expect(executeMove(user, target, move('Simple Beam'), fixed()).target.ability).toBe('Simple');
    const simple = executeMove(user, target, move('Simple Beam'), fixed()).target;
    expect(executeMove(simple, target, move('Swords Dance'), fixed()).user.stages.atk).toBe(4);
    expect(executeMove(user, target, move('Entrainment'), fixed()).target.ability).toBe(user.ability);
    expect(executeMove(user, target, move('Role Play'), fixed()).user.ability).toBe(target.ability);
    const converted = executeMove(user, target, move('Conversion'), fixed()).user;
    expect(converted.typesOverride).toEqual([user.moves[0]?.type]);
    const resisted = executeMove({ ...user, lastHitByMoveId: getMoveByName('Tackle').id }, target, move('Conversion 2'), fixed()).user;
    expect(resisted.typesOverride).toEqual(['rock']);
    expect(executeMove(user, target, move('Camouflage'), fixed(), { biome: 'cave' }).user.typesOverride).toEqual(['rock']);
  });

  it('transfers status, recycles consumed items, and copies or transforms movesets', () => {
    const user = { ...pokemon('torchic', 'Psycho Shift', 'Recycle', 'Sketch', 'Mimic', 'Transform'),
      status: { kind: 'burn' as const, counter: 0 }, consumedItem: 'Oran Berry' };
    const target = { ...pokemon('wurmple', 'Tackle'), lastMoveId: getMoveByName('Tackle').id };
    const shifted = executeMove(user, target, move('Psycho Shift'), fixed());
    expect(shifted.user.status).toBeNull();
    expect(shifted.target.status?.kind).toBe('burn');
    expect(executeMove(user, pokemon('torchic', 'Splash'), move('Psycho Shift'), fixed()).user.status?.kind).toBe('burn');
    const recycled = executeMove(user, target, move('Recycle'), fixed()).user;
    expect(recycled.heldItem).toBe('Oran Berry');
    const berryBase = pokemon('wurmple', 'Recycle');
    const berryTarget = { ...berryBase, currentHp: Math.floor(berryBase.maxHp / 2) + 10, heldItem: 'Oran Berry' };
    const berryEaten = executeBattleTurn(startWildBattle(pokemon('torchic', 'Tackle'), berryTarget), 0, fixed(0.99)).enemy;
    expect(berryEaten.consumedItem).toBe('Oran Berry');
    expect(executeMove(berryEaten, target, move('Recycle'), fixed()).user.heldItem).toBe('Oran Berry');
    const transformed = executeMove(user, target, move('Transform'), fixed()).user;
    expect(transformed.moves.map((slot) => slot.id)).toEqual(target.moves.map((slot) => slot.id));
    expect(transformed.moves[0]?.currentPp).toBe(5);
    const sketched = executeMove(user, target, move('Sketch'), fixed()).user;
    expect(sketched.moves.find((slot) => slot.id === getMoveByName('Tackle').id)?.maxPp).toBe(1);
    expect(prepareBattleEntry(sketched).moves.map((slot) => slot.id)).toEqual(user.moves.map((slot) => slot.id));
  });

  it('calls valid moves through Copycat, Mirror Move, Metronome, Assist, and Nature Power', () => {
    const user = { ...pokemon('torchic', 'Copycat', 'Mirror Move', 'Metronome', 'Assist', 'Nature Power'),
      lastHitByMoveId: getMoveByName('Tackle').id };
    const target = pokemon('wurmple', 'Splash');
    const copycat = executeMove(user, target, move('Copycat'), fixed(), { lastMoveUsedId: getMoveByName('Tackle').id });
    expect(copycat.target.currentHp).toBeLessThan(target.currentHp);
    const mirror = executeMove(user, target, move('Mirror Move'), fixed());
    expect(mirror.target.currentHp).toBeLessThan(target.currentHp);
    expect(executeMove(user, target, move('Metronome'), fixed()).messages.join(' ')).toContain('usou');
    const assist = executeMove(user, target, move('Assist'), fixed(), {
      userParty: [user, pokemon('treecko', 'Tackle')], userActiveIndex: 0,
    });
    expect(assist.target.currentHp).toBeLessThan(target.currentHp);
    const nature = executeMove(user, target, move('Nature Power'), fixed(), { biome: 'cave' });
    expect(nature.target.currentHp).toBeLessThan(target.currentHp);
  });

  it('turns Healing Wish into a full restore on the next replacement', () => {
    const user = { ...pokemon('torchic', 'Healing Wish'), speed: 999 };
    const reserve = { ...pokemon('treecko', 'Tackle'), currentHp: 1, status: { kind: 'poison' as const, counter: 0 } };
    let battle = startWildBattle([user, reserve], pokemon('wurmple', 'Splash'));
    battle = executeBattleTurn(battle, 0, fixed(0.99));
    expect(battle.player.currentHp).toBe(0);
    expect(battle.pendingPartyRestore?.player?.fullPp).toBe(false);
    battle = switchPlayerIn(battle, 1);
    expect(battle.player.currentHp).toBe(reserve.maxHp);
    expect(battle.player.status).toBeNull();

    const lunar = { ...pokemon('torchic', 'Lunar Dance'), speed: 999 };
    const lowPp = { ...pokemon('treecko', 'Tackle'), currentHp: 1, moves: [
      { ...move('Tackle'), currentPp: 1 },
    ] };
    let lunarBattle = executeBattleTurn(startWildBattle([lunar, lowPp], pokemon('wurmple', 'Splash')), 0, fixed(0.99));
    expect(lunarBattle.pendingPartyRestore?.player?.fullPp).toBe(true);
    lunarBattle = switchPlayerIn(lunarBattle, 1);
    expect(lunarBattle.player.moves[0]?.currentPp).toBe(lunarBattle.player.moves[0]?.maxPp);
  });

  it('keeps doubles-only support moves explicit in singles and makes Powder/Electrify affect the selected move', () => {
    for (const name of ['Follow Me', 'Rage Powder', 'Helping Hand', 'After You', 'Ally Switch', 'Quash']) {
      const result = executeMove(pokemon('torchic', name), pokemon('wurmple', 'Tackle'), move(name), fixed());
      expect(result.messages.at(-1)).toBe('Mas não teve efeito!');
    }
    const faster = { ...pokemon('wurmple', 'Tackle'), speed: 999 };
    const slower = { ...pokemon('torchic', 'Snatch'), speed: 1 };
    expect(orderActions(startWildBattle(slower, faster), { side: 'player', moveIndex: 0 }, { side: 'enemy', moveIndex: 0 }, fixed())[0]?.side).toBe('player');
    const coated = { ...slower, moves: [move('Magic Coat')] };
    expect(orderActions(startWildBattle(coated, faster), { side: 'player', moveIndex: 0 }, { side: 'enemy', moveIndex: 0 }, fixed())[0]?.side).toBe('player');
    const powdered = { ...slower, moves: [move('Powder')] };
    expect(orderActions(startWildBattle(powdered, faster), { side: 'player', moveIndex: 0 }, { side: 'enemy', moveIndex: 0 }, fixed())[0]?.side).toBe('player');
  });

  it('reflects, steals, suppresses, and applies same-turn reaction effects', () => {
    const snatcher = { ...pokemon('torchic', 'Snatch'), speed: 1 };
    const dancer = { ...pokemon('wurmple', 'Swords Dance'), speed: 999 };
    const stolen = executeBattleTurn(startWildBattle(snatcher, dancer), 0, fixed(0.99));
    expect(stolen.player.stages.atk).toBe(2);
    expect(stolen.enemy.stages.atk).toBe(0);

    const coatUser = { ...pokemon('torchic', 'Magic Coat'), speed: 999 };
    const toxicUser = { ...pokemon('wurmple', 'Toxic'), speed: 1 };
    const reflected = executeBattleTurn(startWildBattle(coatUser, toxicUser), 0, fixed());
    expect(reflected.player.status).toBeNull();
    expect(reflected.enemy.status?.kind).toBe('toxic');

    const powderUser = { ...pokemon('torchic', 'Powder'), speed: 999 };
    const fireUser = { ...pokemon('wurmple', 'Flamethrower'), speed: 1 };
    const powdered = executeBattleTurn(startWildBattle(powderUser, fireUser), 0, fixed(0.99));
    expect(powdered.enemy.maxHp - powdered.enemy.currentHp).toBe(Math.floor(fireUser.maxHp / 4));
    expect(powdered.player.currentHp).toBe(powderUser.maxHp);

    const elect = { ...pokemon('mudkip', 'Electrify'), speed: 999 };
    const aquatic = pokemon('wurmple', 'Tackle');
    const electrified = executeBattleTurn(startWildBattle(elect, aquatic), 0, fixed(0.99));
    const ordinary = executeBattleTurn(startWildBattle({ ...elect, moves: [move('Splash')] }, aquatic), 0, fixed(0.99));
    expect(electrified.player.maxHp - electrified.player.currentHp).toBeGreaterThan(ordinary.player.maxHp - ordinary.player.currentHp);
  });

  it('zeros the PP of a direct move that knocks out a Pokémon protected by Grudge', () => {
    const grudgeUser = { ...pokemon('torchic', 'Grudge'), currentHp: 1, speed: 999 };
    const prepared = executeMove(grudgeUser, pokemon('wurmple', 'Tackle'), move('Grudge'), fixed()).user;
    expect(advanceVolatileTurn(prepared).pokemon.volatile.grudge).toBe(true);
    const attacker = { ...pokemon('wurmple', 'Tackle'), attack: 999, speed: 1 };
    const result = executeBattleTurn(startWildBattle(grudgeUser, attacker), 0, fixed(0.99));
    expect(result.player.currentHp).toBe(0);
    expect(result.enemy.moves[0]?.currentPp).toBe(0);
  });

  it('blocks shared moves with Imprison before the opposing action can use them', () => {
    const user = { ...pokemon('torchic', 'Imprison', 'Tackle'), speed: 999 };
    const foe = { ...pokemon('wurmple', 'Tackle'), speed: 1 };
    const result = executeBattleTurn(startWildBattle(user, foe), 0, fixed(0.99));
    expect(result.enemy.currentHp).toBe(foe.maxHp);
    expect(result.log.some((line) => line.includes('por Imprison'))).toBe(true);
  });
});
