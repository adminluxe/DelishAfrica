module.exports = {
  apps: [{
    name: 'delish-api',
    cwd: './services/api',
    script: 'dist/main.js',        // on lance le build compilé
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'development',
      PORT: 4001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4001
      // CORS_ORIGINS sera injecté à chaud via --update-env
    }
  }]
}
