import { swagger } from '@elysiajs/swagger';
import app from './app';
import { checkDatabaseHealth, closeDatabaseConnection } from './db';
import { propertyRoutes } from './routes/properties';
import { lendingRoutes } from './routes/lending';
import { userRoutes } from './routes/users';
import { kycRoutes } from './routes/kyc';
import { oracleRoutes } from './routes/oracle';
import { errorHandler } from './middleware/errorHandler';

// Add swagger to the base app
app.use(
  swagger({
    documentation: {
      info: {
        title: 'Real Estate DeFi API',
        version: '1.0.0',
        description:
          'Backend API for Real Estate Tokenization and DeFi Lending Platform on Stellar',
      },
    },
  }),
);

// Add health check endpoint
app
  .get('/health', async () => {
    const dbHealth = await checkDatabaseHealth();

    return {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: {
          healthy: dbHealth.healthy,
          latency: dbHealth.latency,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
      },
    };
  })
  .use(errorHandler)
  .use(propertyRoutes)
  .use(lendingRoutes)
  .use(userRoutes)
  .use(kycRoutes)
  .use(oracleRoutes)
  .listen({
    port: Number(process.env.PORT) || 3001,
    hostname: '0.0.0.0',
  });

console.log(`🚀 Real Estate DeFi API is running on port ${process.env.PORT || 3001}`);

console.log(`📚 Swagger docs available at http://localhost:${process.env.PORT || 3001}/swagger`);

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, closing database connections...`);
  await closeDatabaseConnection();

  console.log('Database connections closed. Exiting...');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
