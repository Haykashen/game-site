import { buildApp } from './app.js';
import { env } from './env.js';
import { startAuctionWorker } from './market/auctionCloser.js';

const app = await buildApp();

const stopWorker = startAuctionWorker(app.prisma);

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  app.log.info({ signal }, 'Shutting down DiscVault API');
  stopWorker();

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Failed to shut down cleanly');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.host, port: env.port });
} catch (error) {
  app.log.error({ err: error }, 'Failed to start DiscVault API');
  stopWorker();
  await app.close();
  process.exit(1);
}
