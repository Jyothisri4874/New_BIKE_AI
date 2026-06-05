import customerOtpRoutes from "./modules/customerOtp/customerOtp.routes";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { errorHandler, notFoundHandler } from "./middlewares/error";
import { asyncHandler } from "./utils/asyncHandler";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import customersRoutes from "./modules/customers/customers.routes";
import vehiclesRoutes from "./modules/vehicles/vehicles.routes";
import dealersRoutes from "./modules/dealers/dealers.routes";
import bookingsRoutes from "./modules/bookings/bookings.routes";
import jobcardsRoutes from "./modules/jobcards/jobcards.routes";
import billingRoutes from "./modules/billing/billing.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import { serviceTrackingRouter, wipTrackingRouter } from "./modules/wipTracking/wipTracking.routes";

export function createApp() {
  const app = express();

  if (env.trustProxy) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use("/api", rateLimit({ windowMs: 60_000, max: env.rateLimitMax, standardHeaders: true, legacyHeaders: false }));
	
  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
  app.get("/health/db", asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected", time: new Date().toISOString() });
  }));
  app.get("/api/vehicle-oems", asyncHandler(async (_req, res) => {
    res.json(await prisma.vehicleOem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
  }));
  app.get("/api/vehicle-models", asyncHandler(async (req, res) => {
    const oemId = typeof req.query.oemId === "string" ? req.query.oemId : undefined;
    res.json(await prisma.vehicleModel.findMany({
      where: { isActive: true, ...(oemId ? { oemId } : {}) },
      orderBy: { name: "asc" },
    }));
  }));
  app.use("/api/customer-otp", customerOtpRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/vehicles", vehiclesRoutes);
  app.use("/api/dealers", dealersRoutes);
  app.use("/api/service-centers", dealersRoutes);
  app.use("/api/bookings", bookingsRoutes);
  app.use("/api/job-cards", jobcardsRoutes);
  app.use("/api/wip-tracking", wipTrackingRouter);
  app.use("/api/service", serviceTrackingRouter);
  app.use("/api/billing", billingRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
