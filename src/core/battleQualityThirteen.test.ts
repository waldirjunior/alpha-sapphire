import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, runFromBattle, startTrainerBattle, startWildBattle } from './battle';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { toBattleMove } from './battlePokemon';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));
const pokemon = (speciesId: string, level: number, ...moves: string[]) => createPokemonInstance(
  getSpeciesById(speciesId), level, moves.map((name) => getMoveByName(name).id),
);

describe('quality 13: fuga e bloqueio de fuga', () => {
  it.each(['Block', 'Mean Look', 'Spider Web'])('%s impede fuga do alvo', (name) => {
    const target = pokemon('wurmple', 20, 'Tackle');
    const trapped = executeMove(pokemon('torchic', 20, name), target, move(name), always(0)).target;
    const base = startWildBattle(target, pokemon('poochyena', 20, 'Tackle'));
    const active = { ...base.player, volatile: trapped.volatile };
    const battle = { ...base, player: active, playerParty: [active] };

    expect(trapped.volatile.escapeBlocked).toBe(true);
    expect(runFromBattle(battle).status).toBe('ongoing');
    expect(runFromBattle(battle).log.at(-1)).toBe('Wurmple está preso e não pode fugir!');
  });

  it('Teleport encerra batalha selvagem e falha contra treinador ou usuário preso', () => {
    const abra = pokemon('abra', 12, 'Teleport');
    const wild = startWildBattle(abra, pokemon('poochyena', 12, 'Tackle'));
    const trainer = startTrainerBattle(abra, pokemon('poochyena', 12, 'Tackle'), 'Youngster');
    const trappedAbra = { ...abra, volatile: { ...abra.volatile, escapeBlocked: true } };
    const blocked = executeMove(trappedAbra, wild.enemy, move('Teleport'), always(0));

    expect(executeBattleTurn(wild, 0, always(0.5)).status).toBe('fled');
    expect(executeBattleTurn(trainer, 0, always(0.5)).log).toContain('Não é possível fugir de uma batalha contra treinador!');
    expect(blocked.escapeBattle).toBeUndefined();
  });
});
