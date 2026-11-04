import app from './app.ts';
import config from './config/index.ts';
import { sequelize } from './db/models/index.ts';

async function start() {
  await sequelize.authenticate();
  const server = app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));

  const shutdown = () => {
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
