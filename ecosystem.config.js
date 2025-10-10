// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'delish-api',
    cwd: '/home/tontoncestcarre/delishafrica-monorepo',
    script: 'services/api/scripts/start_local.sh',
    interpreter: 'bash',
    interpreter_args: '',   // <- force vide
    exec_mode: 'fork',
    instances: 1,
    time: true,
    autorestart: true,
    restart_delay: 2000,
    min_uptime: '5s',
    env: {
      NODE_ENV: 'development',
      PORT: 4001,
      CORS_ORIGINS: 'http://localhost:5173,https://app.delishafrica.com',
      NODE_OPTIONS: ''      // <- vide pour éviter héritage options Node globales
    }
  }]
};
