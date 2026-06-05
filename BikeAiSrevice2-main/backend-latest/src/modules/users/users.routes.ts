import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = Router();
router.use(requireAuth, requireRole("admin", "dealer"));

router.get(
  "/",
  validate({ query: z.object({ role: z.nativeEnum(UserRole).optional(), dealerId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const { role, dealerId } = req.query as any;
    res.json(await prisma.user.findMany({
      where: { ...(role && { role }), ...(dealerId && { staffOfDealerId: dealerId }) },
      select: { id: true, email: true, phone: true, fullName: true, role: true, isActive: true, staffOfDealerId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }));
  })
);

router.post(
  "/",
  validate({
    body: z.object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      password: z.string().min(8),
      fullName: z.string().min(1).max(120),
      role: z.nativeEnum(UserRole),
      staffOfDealerId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.body;
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const u = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, email: true, phone: true, fullName: true, role: true, isActive: true },
    });
    res.status(201).json(u);
  })
);

router.patch(
  "/:id",
  validate({
    body: z.object({
      fullName: z.string().optional(),
      isActive: z.boolean().optional(),
      role: z.nativeEnum(UserRole).optional(),
      staffOfDealerId: z.string().nullable().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.json(await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, email: true, phone: true, fullName: true, role: true, isActive: true, staffOfDealerId: true },
    }));
  })
);

export default router;
