module.exports = {
  apps: [
    {
      name: 'oms-order-ts-rebuild',
      script: 'npm',
      watch: false,
      ignore_watch: [],
      watch_options: {
        followSymlinks: false,
      },
      args: ' run build-dev',
    },
    {
      name: 'oms-order-dynamodb',
      script: 'npm',
      watch: false,
      ignore_watch: [],
      watch_options: {
        followSymlinks: false,
      },
      args: ' run sls:db:start',
    },
    {
      name: 'oms-order-offline',
      script: 'npm',
      watch: false,
      ignore_watch: [],
      watch_options: {
        followSymlinks: false,
      },
      args: ' run sls:offline:hot-reload',
    },
    {
      name: 'oms-order-elasticmq',
      script: 'npm',
      watch: false,
      ignore_watch: [],
      watch_options: {
        followSymlinks: false,
      },
      args: ' run sls:sqs',
    },
  ],
};
