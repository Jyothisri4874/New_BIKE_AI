import { Router } from "express";
import { z } from "zod";
import { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { BillingService } from "./billing.service";

const router = Router();
router.use(requireAuth, requireRole("admin", "dealer", "service_advisor"));

router.get(
  "/invoices",
  validate({
    query: z.object({
      dealerId: z.string().optional(),
      customerId: z.string().optional(),
      status: z.nativeEnum(InvoiceStatus).optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.json(await BillingService.list(req.query as any)))
);

router.get("/invoices/:id", asyncHandler(async (req, res) => res.json(await BillingService.get(req.params.id))));

router.post(
  "/invoices/from-job-card/:jobCardId",
  validate({ body: z.object({ discount: z.number().nonnegative().optional() }).optional() }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await BillingService.createFromJobCard(req.params.jobCardId, req.body ?? {}))
  )
);

router.post(
  "/invoices/:id/payments",
  validate({
    body: z.object({
      amount: z.number().positive(),
      method: z.nativeEnum(PaymentMethod),
      reference: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    res.status(201).json(await BillingService.addPayment(req.params.id, req.body.amount, req.body.method, req.body.reference))
  )
);

export default router;
