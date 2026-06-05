import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

router.get("/oems", asyncHandler(async (_req, res) => {
  res.json(await prisma.vehicleOem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
}));

router.get(
  "/models",
  validate({ query: z.object({ oemId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const { oemId } = req.query as any;
    res.json(await prisma.vehicleModel.findMany({
      where: { isActive: true, ...(oemId ? { oemId } : {}) },
      orderBy: { name: "asc" },
    }));
  })
);

router.use(requireAuth);

router.get(
  "/",
  validate({ query: z.object({ customerId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    res.json(await prisma.vehicle.findMany({
      where: req.query.customerId ? { customerId: req.query.customerId as string } : undefined,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }));
  })
);

router.post(
  "/",
  validate({
    body: z.object({
      customerId: z.string(),
      oemId: z.string().optional(),
      modelId: z.string().optional(),
      variantId: z.string().optional(),
      registrationNo: z.string().optional(),
      chassisNo: z.string().optional(),
      engineNo: z.string().optional(),
      manufactureYear: z.number().int().optional(),
      fuelType: z.string().optional(),
      colour: z.string().optional(),
      odometerKm: z.number().int().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.vehicle.create({ data: req.body }));
  })
);

router.patch("/:id", asyncHandler(async (req, res) => {
  res.json(await prisma.vehicle.update({ where: { id: req.params.id }, data: req.body }));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.vehicle.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
