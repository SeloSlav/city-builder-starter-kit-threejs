import type { DbConnection } from '../generated/index.ts';
import { createIsolatedConnection } from './spacetimedbClient.ts';
import {
  worldConfigRowToGeneration,
  type AuthoritativeWorldGeneration,
} from '../world/worldConfigAuthority.ts';

export type ServerWorldProbe = {
  generation: AuthoritativeWorldGeneration;
  simTick: number;
};

const PROBE_POLL_MS = 50;
const PROBE_MAX_ATTEMPTS = 80;
const PROBE_TIMEOUT_MS = 8_000;

export function probeServerWorldConfig(): Promise<ServerWorldProbe | null> {
  return new Promise((resolve) => {
    let settled = false;
    let connection: DbConnection | null = null;
    let pollTimer: number | null = null;

    const finish = (result: ServerWorldProbe | null): void => {
      if (settled) return;
      settled = true;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      window.clearTimeout(hardTimeout);
      try {
        connection?.disconnect();
      } catch {
        // Ignore teardown errors on the probe connection.
      }
      connection = null;
      resolve(result);
    };

    const hardTimeout = window.setTimeout(() => finish(null), PROBE_TIMEOUT_MS);

    connection = createIsolatedConnection(undefined, {
      onIdentity: () => {
        connection?.subscriptionBuilder().subscribe('SELECT * FROM world_config');
        let attempts = 0;
        pollTimer = window.setInterval(() => {
          const rows = connection?.db.world_config ? [...connection.db.world_config.iter()] : [];
          if (rows.length > 0) {
            const row = rows[0];
            finish({
              generation: worldConfigRowToGeneration(row),
              simTick: Number(row.simTick),
            });
            return;
          }
          attempts += 1;
          if (attempts >= PROBE_MAX_ATTEMPTS) {
            finish(null);
          }
        }, PROBE_POLL_MS);
      },
      onConnectError: () => finish(null),
    });
  });
}
