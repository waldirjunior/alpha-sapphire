import { describe, expect, it } from 'vitest';
import { advanceVolatileTurn, applyResidualDamage, checkCanAct } from './statusConditions';
import { calculateDamage, createPokemonInstance, executeBattleTurn, startWildBattle } from './battle';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { toBattleMove, type PokemonInstance } from './battlePokemon';
import { rollCritical } from './damage';
import { switchPlayerIn } from './battleParty';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));

function pokemon(speciesId: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(speciesId), level, moves.map((name) => getMoveByName(name).id));
}

describe('quality 13 batch 2: focus, protection, items and sleep', () => {
  it('sets Focus Energy for +2 critical stages and Endure survives lethal direct damage', () => {
    const user = pokemon('torchic', 20, 'Focus Energy', 'Endure', 'Tackle');
    const focused = executeMove(user, pokemon('wurmple', 20, 'Splash'), move('Focus Energy'), always(0)).user;
    expect(focused.volatile.focusEnergy).toBe(true);
    expect(rollCritical(pokemon('wurmple', 20, 'Splash'), move('Tackle'), always(0.1), focused)).toBe(true);

    const attacker = { ...pokemon('wurmple', 20, 'Tackle'), attack: 999, speed: 1 };
    const battle = startWildBattle({ ...user, currentHp: 1, speed: 999 }, attacker);
    const endured = executeBattleTurn(battle, 1, always(0.99));
    expect(endured.player.currentHp).toBe(1);
    expect(endured.player.volatile.enduring).toBe(false);
    const stance = executeMove({ ...user, currentHp: 1 }, attacker, move('Endure'), always(0)).user;
    expect(executeMove(attacker, stance, move('Fissure'), always(0)).target.currentHp).toBe(1);
  });

  it('Baton Pass carries Focus Energy and Aqua Ring; a normal switch clears Magnet Rise', () => {
    const lead = { ...pokemon('torchic', 20, 'Focus Energy', 'Aqua Ring', 'Baton Pass'), speed: 999 };
    const reserve = pokemon('treecko', 20, 'Tackle');
    const foe = pokemon('wurmple', 20, 'Splash');
    let battle = startWildBattle([lead, reserve], foe);
    battle = executeBattleTurn(battle, 0, always(0.99));
    battle = executeBattleTurn(battle, 1, always(0.99));
    battle = executeBattleTurn(battle, 2, always(0.99));
    expect(battle.playerActive).toBe(1);
    expect(battle.player.volatile.focusEnergy).toBe(true);
    expect(battle.player.volatile.aquaRing).toBe(true);

    const risen = { ...reserve, volatile: { ...reserve.volatile, magnetRiseTurns: 3 } };
    const normalSwitch = switchPlayerIn(startWildBattle([lead, risen], foe), 1);
    expect(normalSwitch.player.volatile.magnetRiseTurns).toBe(0);
  });

  it('uses the consecutive protection roll and transfers only removable Bestow items', () => {
    const user = { ...pokemon('torchic', 20, 'Bestow', 'Protect', 'Tackle'), heldItem: 'Oran Berry' };
    const target = pokemon('wurmple', 20, 'Splash');
    const bestowed = executeMove(user, target, move('Bestow'), always(0));
    expect(bestowed.user.heldItem).toBeNull();
    expect(bestowed.target.heldItem).toBe('Oran Berry');
    const emptyHanded = { ...user, heldItem: null };
    const failedBestow = executeMove(emptyHanded, target, move('Bestow'), always(0));
    expect(failedBestow.user.heldItem).toBeNull();
    expect(failedBestow.messages.at(-1)).toBe('Mas não teve efeito!');
    expect(executeMove({ ...user, ability: 'Sticky Hold' }, target, move('Bestow'), always(0)).user.heldItem).toBe('Oran Berry');

    const protectedOnce = executeMove(user, target, move('Protect'), always(0));
    const protectedTwice = executeMove(protectedOnce.user, target, move('Protect'), always(0.75));
    expect(protectedOnce.user.volatile.protectStreak).toBe(1);
    expect(protectedTwice.user.volatile.protecting).toBe(false);
    const failedEndure = executeMove({ ...protectedOnce.user, moves: [move('Endure')] }, target, move('Endure'), always(0.75));
    expect(failedEndure.user.volatile.enduring).toBe(false);
  });

  it.each(['Trick', 'Switcheroo'])('%s swaps held items and only fails when both sides are empty', (name) => {
    const user = { ...pokemon('torchic', 20, name), heldItem: 'Leftovers' };
    const target = { ...pokemon('wurmple', 20, 'Splash'), heldItem: 'Oran Berry' };
    const swapped = executeMove(user, target, move(name), always(0));
    expect(swapped.user.heldItem).toBe('Oran Berry');
    expect(swapped.target.heldItem).toBe('Leftovers');
    expect(executeMove({ ...user, heldItem: null }, { ...target, heldItem: null }, move(name), always(0)).messages.at(-1)).toBe('Mas não teve efeito!');
  });

  it('Rest fully heals and sleeps; Sleep Talk uses another usable move only while asleep', () => {
    const user = { ...pokemon('torchic', 20, 'Rest', 'Sleep Talk', 'Tackle'), currentHp: 1,
      status: { kind: 'burn' as const, counter: 0 } };
    const rested = executeMove(user, pokemon('wurmple', 20, 'Splash'), move('Rest'), always(0)).user;
    expect(rested.currentHp).toBe(rested.maxHp);
    expect(rested.status).toEqual({ kind: 'sleep', counter: 2 });
    expect(checkCanAct(rested, always(0.99), true).canAct).toBe(true);
    const talkTarget = pokemon('wurmple', 50, 'Splash');
    const talked = executeMove(rested, talkTarget, move('Sleep Talk'), always(0.99));
    expect(talked.target.currentHp).toBeLessThan(talkTarget.maxHp);
    expect(executeMove(user, pokemon('wurmple', 20, 'Splash'), move('Sleep Talk'), always(0)).messages.at(-1)).toBe('Mas não teve efeito!');

    const sleeper = { ...pokemon('torchic', 20, 'Sleep Talk', 'Tackle'), status: { kind: 'sleep' as const, counter: 2 }, speed: 999 };
    const battle = startWildBattle(sleeper, pokemon('wurmple', 50, 'Splash'));
    const turn = executeBattleTurn(battle, 0, always(0.99));
    expect(turn.player.status?.counter).toBe(1);
    expect(turn.enemy.currentHp).toBeLessThan(turn.enemy.maxHp);
  });

  it('Refresh cures only supported status and Heal Bell/Aromatherapy cure the full party', () => {
    const user = { ...pokemon('torchic', 20, 'Refresh', 'Heal Bell'), status: { kind: 'toxic' as const, counter: 3 } };
    expect(executeMove(user, pokemon('wurmple', 20, 'Splash'), move('Refresh'), always(0)).user.status).toBeNull();
    expect(executeMove(pokemon('torchic', 20, 'Refresh'), pokemon('wurmple', 20, 'Splash'), move('Refresh'), always(0)).messages.at(-1)).toBe('Mas não teve efeito!');

    for (const name of ['Heal Bell', 'Aromatherapy']) {
      const active = { ...pokemon('torchic', 20, name), status: { kind: 'burn' as const, counter: 0 }, speed: 999 };
      const reserve = { ...pokemon('treecko', 20, 'Tackle'), status: { kind: 'poison' as const, counter: 0 } };
      const battle = startWildBattle([active, reserve], pokemon('wurmple', 20, 'Splash'));
      const cured = executeBattleTurn(battle, 0, always(0.99));
      expect(cured.playerParty.map((member) => member.status)).toEqual([null, null]);
    }
  });
});

describe('quality 13 batch 2: stages, HP, types and residuals', () => {
  it('applies Belly Drum, Shell Smash and Ghost/non-Ghost Curse rules', () => {
    const user = pokemon('torchic', 30, 'Belly Drum', 'Shell Smash', 'Curse');
    const target = pokemon('wurmple', 30, 'Splash');
    const drummed = executeMove({ ...user, currentHp: user.maxHp - 1 }, target, move('Belly Drum'), always(0)).user;
    expect(drummed.currentHp).toBe(user.currentHp - 1 - Math.floor(user.maxHp / 2));
    expect(drummed.stages.atk).toBe(6);
    expect(executeMove({ ...user, currentHp: Math.floor(user.maxHp / 2) }, target, move('Belly Drum'), always(0)).user.currentHp).toBe(Math.floor(user.maxHp / 2));
    expect(executeMove({ ...user, stages: { ...user.stages, atk: 6 } }, target, move('Belly Drum'), always(0)).user.currentHp).toBe(user.currentHp);

    const smashed = executeMove(user, target, move('Shell Smash'), always(0)).user;
    expect(smashed.stages).toMatchObject({ atk: 2, def: -1, spa: 2, spd: -1, spe: 2 });
    const cursed = executeMove(user, target, move('Curse'), always(0));
    expect(cursed.user.stages).toMatchObject({ atk: 1, def: 1, spe: -1 });
    const ghost = pokemon('phantump', 20, 'Curse');
    const ghostCurse = executeMove(ghost, target, move('Curse'), always(0));
    expect(ghostCurse.user.currentHp).toBe(ghost.maxHp - Math.floor(ghost.maxHp / 2));
    expect(ghostCurse.target.volatile.cursed).toBe(true);
    const halfHpGhost = { ...ghost, currentHp: Math.floor(ghost.maxHp / 2) };
    const sacrifice = executeMove(halfHpGhost, target, move('Curse'), always(0));
    expect(sacrifice.user.currentHp).toBe(0);
    expect(sacrifice.target.volatile.cursed).toBe(true);
  });

  it('splits HP and copies, swaps, or inverts stat stages', () => {
    const user = { ...pokemon('torchic', 20, 'Pain Split', 'Psych Up', 'Power Trick'), currentHp: 10,
      stages: { atk: 2, def: -1, spa: 1, spd: 0, spe: 0, accuracy: 0, evasion: 0 } };
    const target = { ...pokemon('wurmple', 20, 'Splash'), currentHp: 30,
      stages: { atk: -2, def: 2, spa: 0, spd: 1, spe: -1, accuracy: 2, evasion: -2 } };
    const split = executeMove(user, target, move('Pain Split'), always(0));
    expect(split.user.currentHp).toBe(Math.min(user.maxHp, 20));
    expect(split.target.currentHp).toBe(Math.min(target.maxHp, 20));
    expect(executeMove(user, target, move('Psych Up'), always(0)).user.stages).toEqual(target.stages);
    const tricked = executeMove(user, target, move('Power Trick'), always(0)).user;
    expect(tricked.attack).toBe(user.defense);
    expect(tricked.defense).toBe(user.attack);
    expect(tricked.volatile.powerTrick).toBe(true);

    for (const [name, stats] of [
      ['Power Swap', ['atk', 'spa']], ['Guard Swap', ['def', 'spd']],
      ['Heart Swap', ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']],
    ] as const) {
      const swapped = executeMove(user, target, move(name), always(0));
      expect(stats.every((stat) => swapped.user.stages[stat] === target.stages[stat]
        && swapped.target.stages[stat] === user.stages[stat])).toBe(true);
    }
    const inverted = executeMove(user, target, move('Topsy-Turvy'), always(0)).target;
    expect(inverted.stages).toEqual({ atk: 2, def: -2, spa: 0, spd: -1, spe: 1, accuracy: -2, evasion: 2 });
  });

  it('heals Aqua Ring each turn, grants Magnet Rise ground immunity, and applies Memento', () => {
    const user = { ...pokemon('torchic', 20, 'Aqua Ring', 'Magnet Rise', 'Memento'), currentHp: 10 };
    const target = pokemon('wurmple', 20, 'Splash');
    const ring = executeMove(user, target, move('Aqua Ring'), always(0)).user;
    expect(ring.volatile.aquaRing).toBe(true);
    expect(applyResidualDamage({ ...ring, currentHp: 10 }).pokemon.currentHp).toBe(10 + Math.floor(user.maxHp / 16));
    const risen = executeMove(user, target, move('Magnet Rise'), always(0)).user;
    expect(risen.volatile.magnetRiseTurns).toBe(5);
    expect(advanceVolatileTurn(risen).pokemon.volatile.magnetRiseTurns).toBe(4);
    expect(calculateDamage(pokemon('wurmple', 20, 'Earthquake'), risen, move('Earthquake'), always(0))).toBe(0);
    const switched = switchPlayerIn(startWildBattle([risen, pokemon('treecko', 20, 'Tackle')], target), 1);
    expect(switched.player.volatile.magnetRiseTurns).toBe(0);
    const memento = executeMove(user, { ...target, stages: { ...target.stages, atk: 1, spa: 1 } }, move('Memento'), always(0));
    expect(memento.user.currentHp).toBe(0);
    expect(memento.target.stages).toMatchObject({ atk: -1, spa: -1 });
    const cursed = applyResidualDamage({ ...target, currentHp: target.maxHp, volatile: { ...target.volatile, cursed: true } });
    expect(target.maxHp - cursed.pokemon.currentHp).toBe(Math.floor(target.maxHp / 4));
    expect(applyResidualDamage({ ...target, ability: 'Magic Guard', volatile: { ...target.volatile, cursed: true } }).pokemon.currentHp).toBe(target.maxHp);
  });
});

describe('quality 13 batch 2: destiny, accuracy, PP and shields', () => {
  it('uses Destiny Bond until the user acts again and Lock-On guarantees one next hit', () => {
    const user = { ...pokemon('torchic', 20, 'Destiny Bond', 'Mind Reader', 'Hydro Pump'), currentHp: 1 };
    const target = pokemon('wurmple', 20, 'Tackle');
    const bonded = executeMove(user, target, move('Destiny Bond'), always(0)).user;
    expect(bonded.volatile.destinyBond).toBe(true);
    const taken = executeMove(target, bonded, move('Tackle'), always(0));
    expect(taken.target.currentHp).toBe(0);
    expect(taken.user.currentHp).toBe(0);

    const battler = { ...pokemon('torchic', 20, 'Destiny Bond', 'Tackle'), speed: 999 };
    const bondTurn = executeBattleTurn(startWildBattle(battler, pokemon('wurmple', 20, 'Splash')), 0, always(0.99));
    expect(bondTurn.player.volatile.destinyBond).toBe(true);
    const nextTurn = executeBattleTurn(bondTurn, 1, always(0.99));
    expect(nextTurn.player.volatile.destinyBond).toBe(false);

    const locked = executeMove(user, target, move('Mind Reader'), always(0));
    expect(locked.user.volatile.lockedOn).toBe(true);
    const hit = executeMove({ ...locked.user, moves: [move('Hydro Pump')], volatile: { ...locked.user.volatile, lockedOn: true } }, target, move('Hydro Pump'), always(0.999));
    expect(hit.target.currentHp).toBeLessThan(target.currentHp);
    expect(hit.user.volatile.lockedOn).toBe(false);
  });

  it('Spite removes up to four PP from the target’s last used move', () => {
    const spite = pokemon('phantump', 20, 'Spite');
    const spent = { ...pokemon('wurmple', 20, 'Tackle'), lastMoveId: getMoveByName('Tackle').id };
    const outcome = executeMove(spite, spent, move('Spite'), always(0));
    expect(outcome.target.moves[0]?.currentPp).toBe(getMoveByName('Tackle').pp - 4);
    const lowPp = { ...spent, moves: spent.moves.map((slot) => ({ ...slot, currentPp: 3 })) };
    expect(executeMove(spite, lowPp, move('Spite'), always(0)).target.moves[0]?.currentPp).toBe(0);
    expect(executeMove(spite, { ...spent, lastMoveId: null }, move('Spite'), always(0)).messages.at(-1)).toBe('Mas não teve efeito!');
  });

  it('Spiky Shield chips contact attackers, King’s Shield lowers Attack, and utility moves stay cosmetic', () => {
    const shieldUser = { ...pokemon('torchic', 20, 'Spiky Shield'), speed: 999 };
    const attacker = { ...pokemon('wurmple', 20, 'Tackle'), speed: 1 };
    const spiky = executeBattleTurn(startWildBattle(shieldUser, attacker), 0, always(0.99));
    expect(attacker.currentHp - spiky.enemy.currentHp).toBe(Math.max(1, Math.floor(attacker.maxHp / 8)));

    const kingUser = { ...pokemon('torchic', 20, 'King’s Shield'), speed: 999 };
    const king = executeBattleTurn(startWildBattle(kingUser, attacker), 0, always(0.99));
    expect(king.enemy.currentHp).toBe(attacker.currentHp);
    expect(king.enemy.stages.atk).toBe(-2);
    const statusAttacker = { ...pokemon('wurmple', 20, 'Growl'), speed: 1 };
    const kingStatus = executeBattleTurn(startWildBattle(kingUser, statusAttacker), 0, always(0.99));
    expect(kingStatus.player.stages.atk).toBe(-1);

    for (const name of ['Celebrate', 'Hold Hands', 'Happy Hour']) {
      const user = pokemon('torchic', 20, name);
      const outcome = executeMove(user, targetPokemon(), move(name), always(0));
      expect(outcome.user).toBe(user);
      expect(outcome.target.currentHp).toBe(outcome.target.maxHp);
      expect(outcome.messages.at(-1)).not.toContain('ainda não é simulado');
    }
  });
});

function targetPokemon(): PokemonInstance {
  return pokemon('wurmple', 20, 'Splash');
}
