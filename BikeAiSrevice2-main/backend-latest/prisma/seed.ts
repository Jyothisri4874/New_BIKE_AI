import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bikeai.local" },
    update: {},
    create: { email: "admin@bikeai.local", fullName: "Platform Admin", passwordHash, role: "admin" },
  });

  const honda = await prisma.vehicleOem.upsert({
    where: { name: "Honda" }, update: {}, create: { name: "Honda" },
  });
  const hero = await prisma.vehicleOem.upsert({
    where: { name: "Hero" }, update: {}, create: { name: "Hero" },
  });

  await prisma.vehicleModel.upsert({
    where: { oemId_name: { oemId: honda.id, name: "Activa 125" } },
    update: {},
    create: { oemId: honda.id, name: "Activa 125", segment: "scooter", fuelType: "petrol" },
  });
  await prisma.vehicleModel.upsert({
    where: { oemId_name: { oemId: hero.id, name: "Splendor Plus" } },
    update: {},
    create: { oemId: hero.id, name: "Splendor Plus", segment: "commuter", fuelType: "petrol" },
  });

  const dealer = await prisma.dealer.create({
    data: {
      ownerId: admin.id,
      name: "BikeAI Demo Workshop",
      city: "Hyderabad", state: "TS", pincode: "500001",
      phone: "+919999999999", email: "demo@bikeai.local",
      status: "active", isPickupEnabled: true, isRsaEnabled: true,
    },
  });

  console.log("Seeded:", { admin: admin.email, dealer: dealer.id });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
