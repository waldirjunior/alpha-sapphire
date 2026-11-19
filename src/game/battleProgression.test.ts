import { describe, expect, it } from 'vitest';
import { createPokemonInstance, startWildBattle } from '../core/battle';
import { getMoveByName, getSpeciesById } from '../core/dex';
import { getPendingMovePrompt, evolveAfterBattleWithPrompt } from './battleProgression';

describe('battle move learning prompt', () => {
  it('offers each current move slot and the newly learned move', () => {
    const treecko = createPokemonInstance(getSpeciesById('treecko'), 8, [
      getMoveByName('Pound').id,
      getMoveByName('Leer').id,
      getMoveByName('Absorb').id,
      getMoveByName('Tackle').id,
    ]);
    const battle = {
      ...startWildBattle(treecko, createPokemonInstance(getSpeciesById('poochyena'), 3)),
      pendingMoves: [{ partyIndex: 0, moveId: getMoveByName('Quick Attack').id }],
    };

    expect(getPendingMovePrompt(battle)).toEqual({
      pokemonName: 'Treecko',
      moveName: 'Quick Attack',
      choices: [
        { slot: 0, moveName: 'Pound' },
        { slot: 1, moveName: 'Leer' },
        { slot: 2, moveName: 'Absorb' },
        { slot: 3, moveName: 'Tackle' },
      ],
      skipLabel: 'Desistir de aprender',
    });
  });

  it('has no prompt after the pending move queue is empty', () => {
    const treecko = createPokemonInstance(getSpeciesById('treecko'), 8);
    const battle = startWildBattle(treecko, createPokemonInstance(getSpeciesById('poochyena'), 3));

    expect(getPendingMovePrompt(battle)).toBeNull();
  });
});

describe('post-battle evolution confirmation', () => {
  const treeckoAtEvolutionLevel = () => createPokemonInstance(getSpeciesById('treecko'), 16);

  it('keeps the original species when the player cancels evolution', async () => {
    const treecko = treeckoAtEvolutionLevel();
    const prompts: string[] = [];

    const party = await evolveAfterBattleWithPrompt([treecko], [0], 'day', async (before, after) => {
      prompts.push(`${before.species.name} -> ${after.species.name}`);
      return false;
    });

    expect(prompts).toEqual(['Treecko -> Grovyle']);
    expect(party[0]?.species.name).toBe('Treecko');
  });

  it('applies the evolution only after the player confirms', async () => {
    const party = await evolveAfterBattleWithPrompt([treeckoAtEvolutionLevel()], [0], 'day', async () => true);

    expect(party[0]?.species.name).toBe('Grovyle');
  });

  it('does not prompt members that did not level up in the battle', async () => {
    const treecko = treeckoAtEvolutionLevel();
    let promptCount = 0;

    await evolveAfterBattleWithPrompt([treecko], [], 'day', async () => {
      promptCount += 1;
      return true;
    });

    expect(promptCount).toBe(0);
  });
});
