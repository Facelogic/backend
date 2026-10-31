const app = require('./app');
const { port } = require('./config');
const { sequelize } = require('./db/models');

async function start() {
  await sequelize.authenticate();
  const server = app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

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
