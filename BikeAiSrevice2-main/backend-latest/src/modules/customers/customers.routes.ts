import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { CustomersService } from "./customers.service";

const router = Router();
router.use(requireAuth, requireRole("admin", "dealer", "service_advisor", "crm_executive"));

router.get(
  "/",
  validate({ query: z.object({ search: z.string().optional(), take: z.coerce.number().optional(), skip: z.coerce.number().optional() }) }),
  asyncHandler(async (req, res) => res.json(await CustomersService.list(req.query as any)))
);

router.get("/:id", asyncHandler(async (req, res) => res.json(await CustomersService.get(req.params.id))));

router.post(
  "/",
  validate({
    body: z.object({
      fullName: z.string().min(1).max(120),
      phone: z.string().min(6).max(20),
      email: z.string().email().optional(),
      city: z.string().optional(),
      pincode: z.string().optional(),
      address: z.string().optional(),
      userId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.status(201).json(await CustomersService.create(req.body)))
);

router.patch(
  "/:id",
  validate({
    body: z.object({
      fullName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      city: z.string().optional(),
      pincode: z.string().optional(),
      address: z.string().optional(),
      preferredDealerId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.json(await CustomersService.update(req.params.id, req.body)))
);

router.delete("/:id", requireRole("admin"), asyncHandler(async (req, res) => {
  await CustomersService.remove(req.params.id);
  res.status(204).end();
}));

export default router;
