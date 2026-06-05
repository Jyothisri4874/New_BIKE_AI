import { Router } from "express";
import { requestCustomerOtp, verifyCustomerOtp } from "./customerOtp.service";

const router = Router();

router.post("/request", async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone is required" });
    }

    const result = await requestCustomerOtp(phone);
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: "Phone and code are required" });
    }

    const result = await verifyCustomerOtp(phone, code);
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
