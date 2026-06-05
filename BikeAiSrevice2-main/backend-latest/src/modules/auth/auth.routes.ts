import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthService } from "./auth.service";
import { AuthedRequest, requireAuth } from "../../middlewares/auth";

const router = Router();

router.post(
  "/register",
  validate({
    body: z.object({
      email: z.string().email().optional(),
      phone: z.string().min(6).optional(),
      password: z.string().min(8),
      fullName: z.string().min(1).max(120),
      role: z.enum(["customer", "dealer", "admin"]).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  })
);

router.post(
  "/login",
  validate({
    body: z.object({
      identifier: z.string().min(3),
      password: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await AuthService.login(req.body.identifier, req.body.password);
    res.json(result);
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await AuthService.me(req.user!.sub));
  })
);

export default router;
