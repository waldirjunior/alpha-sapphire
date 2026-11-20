import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, startWildBattle, type PokemonInstance } from './battle';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { advanceVolatileTurn, checkCanAct } from './statusConditions';
import { toBattleMove } from './battlePokemon';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));
const moveIds = (...names: string[]) => names.map((name) => getMoveByName(name).id);

function pokemon(speciesId: string, level: number, moves: string[], personality = 0, heldItem: string | null = null): PokemonInstance {
  return createPokemonInstance(getSpeciesById(speciesId), level, moveIds(...moves), { personality, heldItem });
}

describe('Gen VI remaining volatile moves', () => {
  it('Disable blocks the target’s last used move for four turns', () => {
    const user = pokemon('torchic', 20, ['Disable']);
    const target = { ...pokemon('wurmple', 20, ['Tackle']), lastMoveId: getMoveByName('Tackle').id };
    const result = executeMove(user, target, move('Disable'), always(0.99));

    expect(result.target.volatile).toMatchObject({ disableMoveId: getMoveByName('Tackle').id, disableTurns: 4 });
  });

  it('records the last move used so Disable can affect the next turn', () => {
    const user = pokemon('torchic', 15, ['Disable', 'Tackle']);
    const target = pokemon('wurmple', 15, ['Tackle']);
    const afterEnemyMove = executeBattleTurn(startWildBattle(user, target), 1, always(0.99));
    const afterDisable = executeBattleTurn(afterEnemyMove, 0, always(0.99));

    expect(afterEnemyMove.enemy.lastMoveId).toBe(getMoveByName('Tackle').id);
    expect(afterDisable.enemy.volatile.disableMoveId).toBe(getMoveByName('Tackle').id);
  });

  it('blocks a disabled move without spending its PP', () => {
    const player = pokemon('torchic', 20, ['Tackle', 'Growl']);
    const enemy = pokemon('wurmple', 20, ['Splash']);
    const battle = startWildBattle(player, enemy);
    const disabled = {
      ...battle,
      player: { ...battle.player, volatile: { ...battle.player.volatile, disableMoveId: getMoveByName('Tackle').id, disableTurns: 2 } },
    };
    const result = executeBattleTurn(disabled, 0, always(0.99));

    expect(result.player.moves[0]?.currentPp).toBe(player.moves[0]?.currentPp);
    expect(result.enemy.currentHp).toBe(enemy.currentHp);
    expect(result.log.some((line) => line.includes('não pode usar Tackle'))).toBe(true);
  });

  it('Yawn puts its target to sleep at the end of the following turn', () => {
    const user = pokemon('torchic', 20, ['Yawn', 'Tackle']);
    const target = pokemon('wurmple', 20, ['Splash']);
    const started = executeMove(user, target, move('Yawn'), always(0.99)).target;
    const afterYawnTurn = advanceVolatileTurn(started, always(0.99)).pokemon;
    const afterNextTurn = advanceVolatileTurn(afterYawnTurn, always(0.99)).pokemon;

    expect(afterYawnTurn).toMatchObject({ status: null, volatile: { yawnTurns: 1 } });
    expect(afterNextTurn).toMatchObject({ status: { kind: 'sleep' }, volatile: { yawnTurns: 0 } });
  });

  it('keeps the Yawn target awake for one full battle turn', () => {
    const user = { ...pokemon('torchic', 20, ['Yawn', 'Tackle']), speed: 999 };
    const target = pokemon('wurmple', 20, ['Splash']);
    const firstTurn = executeBattleTurn(startWildBattle(user, target), 0, always(0.99));
    const nextTurn = executeBattleTurn(firstTurn, 1, always(0.99));

    expect(firstTurn.enemy).toMatchObject({ status: null, volatile: { yawnTurns: 1 } });
    expect(nextTurn.enemy.status?.kind).toBe('sleep');
  });

  it('Perish Song counts down from three and faints both active Pokémon at zero', () => {
    const user = pokemon('torchic', 20, ['Perish Song']);
    const target = pokemon('wurmple', 20, ['Splash']);
    const result = executeMove(user, target, move('Perish Song'), always(0.99));
    const firstTurn = [result.user, result.target].map((member) => advanceVolatileTurn(member, always(0.99)).pokemon);
    const secondTurn = firstTurn.map((member) => advanceVolatileTurn(member, always(0.99)).pokemon);
    const thirdTurn = secondTurn.map((member) => advanceVolatileTurn(member, always(0.99)).pokemon);

    expect(firstTurn.map((member) => member.volatile.perishSongTurns)).toEqual([2, 2]);
    expect(secondTurn.map((member) => member.volatile.perishSongTurns)).toEqual([1, 1]);
    expect(thirdTurn.map((member) => member.currentHp)).toEqual([0, 0]);
  });

  it('resolves the Perish Song countdown at battle end of turn', () => {
    const user = { ...pokemon('torchic', 20, ['Perish Song', 'Tackle']), speed: 999 };
    const target = pokemon('wurmple', 20, ['Splash']);
    const started = startWildBattle(user, target);
    const firstTurn = executeBattleTurn(started, 0, always(0.99));
    const secondTurn = executeBattleTurn(firstTurn, 1, always(0.99));
    const thirdTurn = executeBattleTurn(secondTurn, 1, always(0.99));

    expect(firstTurn.player.volatile.perishSongTurns).toBe(2);
    expect(secondTurn.player.volatile.perishSongTurns).toBe(1);
    expect(thirdTurn.player.currentHp).toBe(0);
    expect(thirdTurn.enemy.currentHp).toBe(0);
  });

  it('Attract infatuates only an opposite-gender target and can stop it from acting', () => {
    const male = pokemon('torchic', 20, ['Attract'], 31);
    const female = pokemon('wurmple', 20, ['Tackle'], 0);
    const inflicted = executeMove(male, female, move('Attract'), always(0.99)).target;
    const stopped = checkCanAct(inflicted, always(0.1));
    const sameGender = executeMove(male, { ...female, gender: 'male' }, move('Attract'), always(0.99)).target;

    expect(inflicted.volatile.infatuated).toBe(true);
    expect(stopped.canAct).toBe(false);
    expect(sameGender.volatile.infatuated).not.toBe(true);
    expect(checkCanAct(inflicted, always(0.5)).canAct).toBe(true);
  });

  it('Encore locks the target to its last used move for three turns', () => {
    const user = pokemon('torchic', 20, ['Encore']);
    const target = { ...pokemon('wurmple', 20, ['Tackle', 'Growl']), lastMoveId: getMoveByName('Tackle').id };
    const result = executeMove(user, target, move('Encore'), always(0.99));

    expect(result.target.volatile).toMatchObject({ encoreMoveId: getMoveByName('Tackle').id, encoreTurns: 3 });
  });

  it('forces an encored opponent to spend PP on the locked move', () => {
    const player = pokemon('torchic', 20, ['Tackle']);
    const enemy = pokemon('wurmple', 20, ['Growl', 'Tackle']);
    const battle = startWildBattle(player, enemy);
    const encored = {
      ...battle,
      enemy: { ...battle.enemy, volatile: { ...battle.enemy.volatile, encoreMoveId: getMoveByName('Tackle').id, encoreTurns: 3 } },
      enemyParty: battle.enemyParty.map((member, index) => index === battle.enemyActive
        ? { ...member, volatile: { ...member.volatile, encoreMoveId: getMoveByName('Tackle').id, encoreTurns: 3 } }
        : member),
    };
    const result = executeBattleTurn(encored, 0, always(0));

    expect(result.enemy.moves[0]?.currentPp).toBe(enemy.moves[0]?.currentPp);
    expect(result.enemy.moves[1]?.currentPp).toBe((enemy.moves[1]?.currentPp ?? 0) - 1);
  });
});

describe('Gen VI utility attacks', () => {
  it('Knock Off removes a removable item and gets its Gen VI damage boost', () => {
    const user = pokemon('torchic', 30, ['Knock Off']);
    const held = pokemon('wurmple', 30, ['Splash'], 0, 'Leftovers');
    const empty = pokemon('wurmple', 30, ['Splash']);
    const removed = executeMove(user, held, move('Knock Off'), always(0.99));
    const plain = executeMove(user, empty, move('Knock Off'), always(0.99));

    expect(removed.target.heldItem).toBeNull();
    expect(held.currentHp - removed.target.currentHp).toBeGreaterThan(empty.currentHp - plain.target.currentHp);
  });

  it.each(['U-turn', 'Volt Switch'])('%s damages, then switches to a healthy reserve', (name) => {
    const playerLead = pokemon(name === 'U-turn' ? 'torchic' : 'pikachu', 10, [name]);
    const reserve = pokemon('mudkip', 10, ['Tackle']);
    const enemy = pokemon('wurmple', 40, ['Splash']);
    const battle = startWildBattle([playerLead, reserve], enemy);
    const fastBattle = { ...battle, player: { ...battle.player, speed: 9999 } };
    const result = executeBattleTurn(fastBattle, 0, always(0.99));

    expect(result.playerActive).toBe(1);
    expect(result.player.species.id).toBe('mudkip');
    expect(result.enemy.currentHp).toBeLessThan(enemy.currentHp);
  });

  it('Sucker Punch fails when the target chose a status move and hits when it chose damage', () => {
    const user = pokemon('torchic', 20, ['Sucker Punch']);
    const statusTarget = pokemon('wurmple', 20, ['Growl']);
    const damageTarget = pokemon('wurmple', 20, ['Tackle']);
    const missed = executeBattleTurn(startWildBattle(user, statusTarget), 0, always(0.99));
    const hit = executeBattleTurn(startWildBattle(user, damageTarget), 0, always(0.99));

    expect(missed.enemy.currentHp).toBe(statusTarget.currentHp);
    expect(missed.log.some((line) => line.includes('Sucker Punch, mas falhou'))).toBe(true);
    expect(hit.enemy.currentHp).toBeLessThan(damageTarget.currentHp);
  });
});
