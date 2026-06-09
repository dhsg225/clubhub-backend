/**
 * PM2 ecosystem config for ClubHub TV player-runtime.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup  (run the output as root to enable on-boot)
 *
 * Environment variables loaded from /etc/clubhub/screen.env (set by commissioning tool).
 * Do NOT hardcode SCREEN_ID or VENUE_ID here.
 *
 * Restart policy:
 *   - max_restarts: 10 (within restart_delay window)
 *   - min_uptime: 30s (process must stay up 30s before restart counter resets)
 *   - restart_delay: 5000ms (5s between restarts)
 *   - exponential_backoff_restart_delay: 100 (doubles each restart up to max_restarts)
 *
 * Log management:
 *   - Log files in /var/log/clubhub/ (created by setup-player.sh)
 *   - logrotate handles rotation (logrotate.conf)
 *   - merge_logs: true (stdout + stderr to single file)
 */
module.exports = {
  apps: [
    {
      name: 'clubhub-player',
      script: './dist/index.js',
      cwd: '/opt/clubhub/player',

      // Load screen-specific env from commissioning file
      env_file: '/etc/clubhub/screen.env',

      // Process management
      instances: 1,
      exec_mode: 'fork',

      // Restart policy — exponential backoff on crash
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      exponential_backoff_restart_delay: 100,

      // Watchdog: PM2 will restart if no heartbeat within 30s
      // This is supplemental to our application-level watchdog.
      listen_timeout: 30000,

      // Logging
      output:     '/var/log/clubhub/player.log',
      error:      '/var/log/clubhub/player.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',

      // Environment defaults (overridden by env_file)
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'INFO',
      },
    },
  ],
};
