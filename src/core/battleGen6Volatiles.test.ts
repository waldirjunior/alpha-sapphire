import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, startWildBattle, switchActivePokemon, type PokemonInstance } from './battle';
import { applyEntryHazards, createBattleField, setEntryHazard } from './battleField';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { toBattleMove } from './battlePokemon';

const always = (value: number) => () => value;
const ids = (...names: string[]) => names.map((name) => getMoveByName(name).id);

function pokemon(id: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(id), level, ids(...moves));
}

describe('Gen VI battle field move integration', () => {
  it('sets hazards, then Rapid Spin clears its side and Defog clears both', () => {
    const foe = pokemon('wurmple', 20, 'Tackle');
    const laid = executeBattleTurn(startWildBattle(pokemon('torchic', 20, 'Spikes'), foe), 0, always(0.5));
    const spinBattle = startWildBattle(pokemon('torchic', 20, 'Rapid Spin'), foe);
    const spinField = setEntryHazard(setEntryHazard(createBattleField(), 'player', 'spikes').field, 'enemy', 'stealthRock').field;
    const spun = executeBattleTurn({ ...spinBattle, field: spinField }, 0, always(0.5));
    const defogBattle = startWildBattle(pokemon('torchic', 20, 'Defog'), foe);
    const bothSides = setEntryHazard(setEntryHazard(createBattleField(), 'player', 'spikes').field, 'enemy', 'stealthRock').field;
    const cleared = executeBattleTurn({ ...defogBattle, field: bothSides }, 0, always(0.5));

    expect(laid.field.hazards.enemy.spikes).toBe(1);
    expect(spun.field.hazards).toMatchObject({ player: { spikes: 0 }, enemy: { stealthRock: true } });
    expect(cleared.field.hazards).toMatchObject({ player: { spikes: 0 }, enemy: { stealthRock: false } });
  });

  it('applies entry damage to a voluntary replacement before the opposing action', () => {
    const party = [pokemon('torchic', 20, 'Tackle'), pokemon('mudkip', 20, 'Tackle')];
    const battle = startWildBattle(party, pokemon('wurmple', 20, 'Tackle'));
    const field = setEntryHazard(battle.field, 'player', 'spikes').field;
    const switched = switchActivePokemon({ ...battle, field, pendingSwitch: true }, 1, always(0.5));
    const incoming = party[1];
    if (!incoming) throw new Error('Pokémon do segundo slot esperado na fixture.');

    expect(switched.player.currentHp).toBe(incoming.currentHp - Math.floor(incoming.maxHp / 8));
  });

  it('clears Toxic Spikes when a grounded Poison type enters and lowers Speed with Sticky Web', () => {
    const poisonField = setEntryHazard(createBattleField(), 'player', 'toxicSpikes').field;
    const poisonEntry = enter('bulbasaur', poisonField);
    const steelEntry = enter('aron', poisonField);
    const webField = setEntryHazard(createBattleField(), 'player', 'stickyWeb').field;
    const webEntry = enter('torchic', webField);

    expect(poisonEntry.field.hazards.player.toxicSpikes).toBe(0);
    expect(poisonEntry.pokemon.status).toBeNull();
    expect(steelEntry.pokemon.status).toBeNull();
    expect(steelEntry.field.hazards.player.toxicSpikes).toBe(1);
    expect(webEntry.pokemon.stages.spe).toBe(-1);
  });

  it('drains Leech Seed into its user and Taunt blocks a status move', () => {
    const seedUser = { ...pokemon('treecko', 20, 'Leech Seed'), currentHp: 10, speed: 999 };
    const seedTarget = pokemon('wurmple', 20, 'Growl');
    const seeded = executeBattleTurn(startWildBattle(seedUser, seedTarget), 0, always(0.5));
    const tauntUser = { ...pokemon('treecko', 20, 'Taunt'), speed: 999 };
    const tauntTarget = pokemon('wurmple', 20, 'Growl');
    const taunted = executeBattleTurn(startWildBattle(tauntUser, tauntTarget), 0, always(0.5));

    expect(seeded.player.currentHp).toBe(Math.min(seedUser.maxHp, 10 + Math.floor(seedTarget.maxHp / 8)));
    expect(taunted.enemy.stages.atk).toBe(0);
    expect(taunted.enemy.volatile.tauntTurns).toBe(2);
  });

  it('reduces repeated Protect success to one half and resets after failure', () => {
    const user = { ...pokemon('torchic', 20, 'Protect'), volatile: { confusionTurns: 0, leechSeeded: false, tauntTurns: 0, protectStreak: 1, protecting: false } };
    const target = pokemon('wurmple', 20, 'Tackle');
    const success = executeMove(user, target, toBattleMove(getMoveByName('Protect')), always(0.49));
    const failure = executeMove(user, target, toBattleMove(getMoveByName('Protect')), always(0.5));

    expect(success.user.volatile.protectStreak).toBe(2);
    expect(failure.user.volatile.protectStreak).toBe(0);
  });
});

function enter(id: string, field: ReturnType<typeof createBattleField>) {
  const entering = pokemon(id, 20, 'Tackle');
  return applyEntryHazards(field, 'player', entering);
}
