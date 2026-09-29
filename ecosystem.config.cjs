/**
 * PM2 process management for production servers (Node 20+, no Docker).
 *
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup    # survive reboots (run the printed command)
 *
 * Logs go to logs/, which the pm2-logrotate module will rotate:
 *   pm2 install pm2-logrotate
 */
module.exports = {
  apps: [
    {
      name: 'orca',
      script: 'dist/server.cjs',
      instances: 1, // single instance: the process holds in-memory live caches
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      time: true,
      kill_timeout: 8000, // matches the graceful-shutdown drain window
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      out_file: 'logs/orca-out.log',
      error_file: 'logs/orca-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};