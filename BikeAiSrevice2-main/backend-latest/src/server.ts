import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

async function main() {
  await prisma.$connect();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[bikeai-backend] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});

process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGINT",  async () => { await prisma.$disconnect(); process.exit(0); });
