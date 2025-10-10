/**
 * PM2 ecosystem for DelishAfrica API (dev)
 * - Lance Nest via ts-node (transpile-only) + tsconfig-paths
 * - Port: 4001
 * - DB: delish_user/delish_pass → delish_db (public)
 * - Stripe: clé test + webhook secret
 * - PRISMA_SKIP_ENV_LOAD=1 pour ignorer prisma/.env et forcer DATABASE_URL ci-dessous
 *
 * Démarrage:
 *   pm2 start ecosystem.config.js --only delish-api
 *   pm2 save
 *
 * Logs:
 *   pm2 logs delish-api --lines 120
 */
module.exports = {
  apps: [
    {
      name: "delish-api",
      cwd: "./", // services/api
      script: "node",
      args: "-r ts-node/register/transpile-only -r tsconfig-paths/register src/main.ts",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 4001,
        PRISMA_SKIP_ENV_LOAD: 1,
        DATABASE_URL: "postgresql://delish_user:delish_pass@localhost:5432/delish_db?schema=public",
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
      }
    }
  ]
};
