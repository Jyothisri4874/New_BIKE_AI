import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { AuthedRequest, requireAuth } from "../../middlewares/auth";
import { BookingsService } from "./bookings.service";
import { BookingStatus } from "@prisma/client";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  validate({
    query: z.object({
      dealerId: z.string().optional(),
      customerId: z.string().optional(),
      status: z.nativeEnum(BookingStatus).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.json(await BookingsService.list(req.query as any)))
);

router.get("/:id", asyncHandler(async (req, res) => res.json(await BookingsService.get(req.params.id))));

router.post(
  "/",
  validate({
    body: z.object({
      customerId: z.string(),
      dealerId: z.string(),
      vehicleId: z.string().optional(),
      serviceType: z.string().min(1).max(80),
      scheduledAt: z.coerce.date(),
      notes: z.string().max(1000).optional(),
      reportedIssues: z.any().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.status(201).json(await BookingsService.create(req.body)))
);

router.patch(
  "/:id/status",
  validate({ body: z.object({ status: z.nativeEnum(BookingStatus), note: z.string().optional() }) }),
  asyncHandler<AuthedRequest>(async (req, res) =>
    res.json(await BookingsService.updateStatus(req.params.id, req.body.status, req.user?.sub, req.body.note))
  )
);

router.post("/:id/cancel", asyncHandler<AuthedRequest>(async (req, res) =>
  res.json(await BookingsService.cancel(req.params.id, req.user?.sub))
));

export default router;
