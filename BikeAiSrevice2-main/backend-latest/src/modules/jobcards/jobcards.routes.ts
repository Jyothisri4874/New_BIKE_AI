import { Router } from "express";
import { z } from "zod";
import { JobCardStatus, JobItemKind } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { JobCardsService } from "./jobcards.service";

const router = Router();
router.use(requireAuth, requireRole("admin", "dealer", "service_advisor", "technician"));

router.get(
  "/",
  validate({
    query: z.object({
      dealerId: z.string().optional(),
      status: z.nativeEnum(JobCardStatus).optional(),
      technicianId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.json(await JobCardsService.list(req.query as any)))
);

router.get("/:id", asyncHandler(async (req, res) => res.json(await JobCardsService.get(req.params.id))));

router.post(
  "/",
  validate({
    body: z.object({
      bookingId: z.string().optional(),
      dealerId: z.string(),
      customerId: z.string(),
      vehicleId: z.string(),
      advisorId: z.string().optional(),
      complaint: z.string().max(2000).optional(),
      odometerKm: z.number().int().optional(),
      fuelLevel: z.string().optional(),
      priority: z.number().int().min(1).max(5).optional(),
      estimatedReady: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.status(201).json(await JobCardsService.create(req.body)))
);

router.patch(
  "/:id/status",
  validate({ body: z.object({ status: z.nativeEnum(JobCardStatus) }) }),
  asyncHandler(async (req, res) => res.json(await JobCardsService.updateStatus(req.params.id, req.body.status)))
);

router.patch(
  "/:id/assign",
  validate({ body: z.object({ technicianId: z.string() }) }),
  asyncHandler(async (req, res) => res.json(await JobCardsService.assignTechnician(req.params.id, req.body.technicianId)))
);

router.post(
  "/:id/items",
  validate({
    body: z.object({
      kind: z.nativeEnum(JobItemKind),
      name: z.string().min(1).max(200),
      partNumber: z.string().optional(),
      quantity: z.number().positive().optional(),
      unitPrice: z.number().nonnegative(),
      taxPercent: z.number().min(0).max(100).optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.status(201).json(await JobCardsService.addItem(req.params.id, req.body)))
);

router.delete("/items/:itemId", asyncHandler(async (req, res) => {
  await JobCardsService.removeItem(req.params.itemId);
  res.status(204).end();
}));

router.post(
  "/:id/approvals",
  validate({
    body: z.object({
      description: z.string().min(1).max(2000),
      estimate: z.number().nonnegative(),
      mediaUrls: z.array(z.string().url()).optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await JobCardsService.requestApproval(req.params.id, req.body.description, req.body.estimate, req.body.mediaUrls ?? []))
  )
);

router.patch(
  "/approvals/:approvalId",
  validate({ body: z.object({ approved: z.boolean() }) }),
  asyncHandler(async (req, res) => res.json(await JobCardsService.decideApproval(req.params.approvalId, req.body.approved)))
);

export default router;
