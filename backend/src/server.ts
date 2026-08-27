import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function startServer() {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
