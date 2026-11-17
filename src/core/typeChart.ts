import { fromTables } from './battleTables';

// Ordem dos índices de tipo da ROM ORAS (DllBattle.cro, A-010); types.json é validado contra ela.
export const ELEMENTAL_TYPES = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy',
] as const;

export type ElementalType = (typeof ELEMENTAL_TYPES)[number];

function assertTypeOrder(names: readonly string[]): void {
  const actual = names.map((name) => name.toLowerCase()).join(',');
  if (actual !== ELEMENTAL_TYPES.join(',')) {
    throw new Error(`types.json fora da ordem ORAS: recebido [${actual}], esperado [${ELEMENTAL_TYPES.join(',')}].`);
  }
}

const effectiveness = fromTables((tables) => {
  assertTypeOrder(tables.types.types);
  return tables.types.effectiveness;
});

export function isElementalType(value: string): value is ElementalType {
  return (ELEMENTAL_TYPES as readonly string[]).includes(value);
}

export function toElementalType(value: string): ElementalType {
  const normalized = value.toLowerCase();
  if (!isElementalType(normalized)) {
    throw new Error(`Tipo desconhecido: "${value}" (esperado um de ${ELEMENTAL_TYPES.join(', ')}).`);
  }
  return normalized;
}

export function getTypeMultiplier(attackType: ElementalType, defenderType: ElementalType): number {
  const row = effectiveness()[ELEMENTAL_TYPES.indexOf(attackType)];
  const multiplier = row?.[ELEMENTAL_TYPES.indexOf(defenderType)];
  if (multiplier === undefined) {
    throw new Error(`Tabela de tipos incompleta para ${attackType} → ${defenderType}.`);
  }
  return multiplier;
}

export function getTypeEffectivenessAgainst(
  attackType: ElementalType,
  defenderTypes: readonly ElementalType[]
): number {
  const distinct = [...new Set(defenderTypes)];
  return distinct.reduce((product, defenderType) => product * getTypeMultiplier(attackType, defenderType), 1);
}
