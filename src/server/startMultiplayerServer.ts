import type { MapDefinition } from '../core/types';
import { getZoneMap } from '../data/maps_v2/loader';
import { createMultiplayerServer } from './multiplayerServer';

function serverPort(): number {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`PORT inválida: ${process.env.PORT} (esperado inteiro entre 0 e 65535).`);
  }
  return port;
}

async function loadZoneMaps(): Promise<Record<string, MapDefinition>> {
  const zones = await Promise.all(Array.from({ length: 536 }, (_, zoneId) => getZoneMap(zoneId)));
  return Object.fromEntries(zones.map((map) => [map.id, map]));
}

const maps = await loadZoneMaps();
const multiplayerServer = createMultiplayerServer({ maps });
const port = await multiplayerServer.listen(serverPort(), '0.0.0.0');
process.stdout.write(`Servidor multiplayer ouvindo na porta ${port}.\n`);

const stop = (): void => { void multiplayerServer.close(); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
