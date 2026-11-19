import type { MapNpc } from './types';

export interface NpcInteractionOutcome {
  text: string;
  healed: boolean;
  restockItems?: { potions: number; pokeballs: number };
}

const NURSE_JOY_MODEL = 298;
const NURSE_JOY_SCRIPT = 2100;
const MART_CLERK_MODEL = 299;
const MOM_MODEL = 280;

function actorIndex(npc: MapNpc): number {
  const parsed = Number(npc.id.split(':').at(-1));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Resolve diálogo e efeitos de NPCs quando a zona ainda não tem imagem AMX carregada (P-013). */
export function resolveNpcInteraction(
  npc: MapNpc,
  mapId: string,
  zoneLines: readonly string[]
): NpcInteractionOutcome {
  if (npc.model === NURSE_JOY_MODEL || npc.script === NURSE_JOY_SCRIPT) {
    return {
      text: 'Enfermeira Joy: Seus Pokémon descansaram e estão com energia máxima!',
      healed: true,
    };
  }

  if ((mapId === 'zone_0223' || mapId === 'zone_0225') && npc.model === MOM_MODEL) {
    return {
      text: 'Mãe: Descanse um pouco em casa! Seus Pokémon foram totalmente curados.',
      healed: true,
    };
  }

  if (npc.model === MART_CLERK_MODEL) {
    return {
      text: 'Atendente do Poké Mart: Aqui estão 2 Potions e 5 Poké Balls para a sua jornada!',
      healed: false,
      restockItems: { potions: 2, pokeballs: 5 },
    };
  }

  const validLines = zoneLines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (validLines.length > 0) {
    return {
      text: validLines[actorIndex(npc) % validLines.length],
      healed: false,
    };
  }

  return { text: 'Olá! Bem-vindo a Hoenn.', healed: false };
}
