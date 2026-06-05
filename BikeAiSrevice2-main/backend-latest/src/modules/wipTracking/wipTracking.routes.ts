import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { WipTrackingService } from "./wipTracking.service";

const createSchema = z.object({
  service_center_id: z.string().min(1),
  dealer_dms_job_no: z.string().min(1).max(120),
  customer_name: z.string().min(1).max(160),
  customer_mobile: z.string().min(6).max(30),
  vehicle_number: z.string().min(1).max(40),
  vehicle_model: z.string().max(160).optional(),
  service_type: z.string().min(1).max(120),
  customer_complaint: z.string().max(2000).optional(),
  current_status: z.string().min(1).max(80).optional(),
  tracking_code: z.string().min(8).max(120).optional(),
  tracking_url: z.string().url().optional(),
  qr_code_url: z.string().url().optional(),
  pdf_url: z.string().url().optional(),
  assigned_advisor_id: z.string().optional(),
  assigned_technician_id: z.string().optional(),
});

function apiBaseUrl(req: { protocol: string; get(name: string): string | undefined }) {
  return `${req.protocol}://${req.get("host")}`;
}

export const wipTrackingRouter = Router();
wipTrackingRouter.use(requireAuth);

wipTrackingRouter.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const record = await WipTrackingService.create(req.body, apiBaseUrl(req));
    res.status(201).json(record);
  })
);

wipTrackingRouter.get(
  "/:id",
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    res.json(await WipTrackingService.getById(req.params.id));
  })
);

export const serviceTrackingRouter = Router();

serviceTrackingRouter.get(
  "/track/:trackingCode",
  validate({ params: z.object({ trackingCode: z.string().min(8).max(120) }) }),
  asyncHandler(async (req, res) => {
    res.json(await WipTrackingService.getByTrackingCode(req.params.trackingCode));
  })
);
