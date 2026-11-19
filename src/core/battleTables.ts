// ADR-004 (pipeline-rom): as tabelas da ROM não são importadas estaticamente pelo core; o host
// injeta um loader (dynamic import no Vite, leitura direta nos testes) e o core mantém cache em memória.

export interface RawBaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface RawSpecies {
  personalIndex: number;
  species: number;
  form: number;
  name: string;
  evolutionStage?: number;
  types: readonly string[];
  baseStats: RawBaseStats;
  abilities: readonly string[];
  growthRate: string;
  eggGroups: readonly string[];
  catchRate: number;
  baseExp: number;
  baseFriendship: number;
  evYield: RawBaseStats;
  tms: readonly number[];
  hms: readonly number[];
}

export interface RawStatChange {
  stat: number;
  stages: number;
  percent: number;
}

export interface RawMove {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  quality: number;
  hitMin: number;
  hitMax: number;
  inflict: number;
  inflictPercent: number;
  turnMin: number;
  turnMax: number;
  flinchPercent: number;
  recoilPercent: number;
  healing: number;
  target: number;
  critStage: number;
  flags?: number;
  statChanges: readonly RawStatChange[];
}

export interface RawTypeTable {
  types: readonly string[];
  effectiveness: readonly (readonly number[])[];
}

export interface RawLearnset {
  personalIndex: number;
  levelUp: readonly { level: number; move: number }[];
}

export interface RawMachines {
  tmMoves: readonly number[];
  hmMoves: readonly number[];
}

export interface RawEvolutionSet {
  personalIndex: number;
  evolutions: readonly { method: string; argument: number; species: number; itemName?: string }[];
}

export interface RawNature {
  id: number;
  name: string;
  increased: string | null;
  decreased: string | null;
}

export interface BattleTables {
  species: readonly RawSpecies[];
  moves: readonly RawMove[];
  types: RawTypeTable;
  learnsets: readonly RawLearnset[];
  machines: RawMachines;
  evolutions: readonly RawEvolutionSet[];
  natures: readonly RawNature[];
}

export type BattleTableLoader = { [K in keyof BattleTables]: () => Promise<BattleTables[K]> };

let registered: BattleTables | null = null;
let pending: Promise<BattleTables> | null = null;

export function registerBattleTables(tables: BattleTables): void {
  registered = tables;
}

export function getBattleTables(): BattleTables {
  if (!registered) {
    throw new Error('Tabelas de batalha não carregadas: aguarde loadBattleTables(loader) antes de usar dex/learnsets/evolução.');
  }
  return registered;
}

/** Carrega todas as tabelas uma única vez; chamadas concorrentes compartilham a mesma promessa. */
export function loadBattleTables(loader: BattleTableLoader): Promise<BattleTables> {
  if (registered) return Promise.resolve(registered);
  pending ??= fetchAll(loader).then((tables) => {
    registerBattleTables(tables);
    return tables;
  });
  return pending;
}

async function fetchAll(loader: BattleTableLoader): Promise<BattleTables> {
  const [species, moves, types, learnsets, machines, evolutions, natures] = await Promise.all([
    loader.species(),
    loader.moves(),
    loader.types(),
    loader.learnsets(),
    loader.machines(),
    loader.evolutions(),
    loader.natures(),
  ]);
  return { species, moves, types, learnsets, machines, evolutions, natures };
}

/** Valor derivado das tabelas, recalculado só quando outras tabelas são registradas. */
export function fromTables<T>(build: (tables: BattleTables) => T): () => T {
  let source: BattleTables | null = null;
  let value: T | undefined;
  return () => {
    const tables = getBattleTables();
    if (source !== tables || value === undefined) {
      value = build(tables);
      source = tables;
    }
    return value;
  };
}
