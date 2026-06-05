const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "bikeai-api",
      cwd: path.join(__dirname, "backend-latest"),
      script: "dist/server.js",
      interpreter: "node",
      node_args: "--enable-source-maps --max-old-space-size=384",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "450M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
