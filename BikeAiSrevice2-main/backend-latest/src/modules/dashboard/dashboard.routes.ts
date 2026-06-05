import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";

const router = Router();
router.use(requireAuth, requireRole("admin", "dealer", "service_advisor"));

router.get(
  "/overview",
  validate({ query: z.object({ dealerId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const dealerId = (req.query.dealerId as string) || undefined;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const [
      bookingsToday, openJobs, deliveryPending, revenueAggToday,
      pendingPayments, activeJobs, dueServiceCustomers,
    ] = await Promise.all([
      prisma.booking.count({ where: { ...(dealerId && { dealerId }), scheduledAt: { gte: today, lt: tomorrow } } }),
      prisma.jobCard.count({ where: { ...(dealerId && { dealerId }), status: { in: ["open", "in_progress", "qc"] } } }),
      prisma.jobCard.count({ where: { ...(dealerId && { dealerId }), status: "ready" } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: today, lt: tomorrow }, invoice: dealerId ? { dealerId } : undefined },
      }),
      prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: "issued", ...(dealerId && { dealerId }) },
      }),
      prisma.jobCard.count({ where: { ...(dealerId && { dealerId }), status: "in_progress" } }),
      prisma.vehicle.count({
        where: { amcExpiry: { lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) } },
      }),
    ]);

    res.json({
      bookingsToday,
      openJobs,
      deliveryPending,
      revenueToday: (revenueAggToday._sum.amount as Prisma.Decimal | null)?.toString() ?? "0",
      pendingPayments: (pendingPayments._sum.total as Prisma.Decimal | null)?.toString() ?? "0",
      activeJobs,
      dueServiceCustomers,
    });
  })
);

router.get(
  "/activity",
  validate({ query: z.object({ dealerId: z.string().optional(), take: z.coerce.number().optional() }) }),
  asyncHandler(async (req, res) => {
    const dealerId = (req.query.dealerId as string) || undefined;
    const take = Number(req.query.take ?? 30);
    const items = await prisma.bookingTimeline.findMany({
      where: dealerId ? { booking: { dealerId } } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: { booking: { include: { customer: true, vehicle: true } } },
    });
    res.json(items);
  })
);

export default router;
