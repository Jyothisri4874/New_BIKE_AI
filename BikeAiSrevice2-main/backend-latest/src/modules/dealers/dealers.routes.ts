import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";

const router = Router();

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

router.get(
  "/",
  validate({ query: z.object({ city: z.string().optional(), status: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).optional() }) }),
  asyncHandler(async (req, res) => {
    const { city, status, limit } = req.query as any;
    res.json(await prisma.dealer.findMany({
      where: { isActive: true, ...(city && { city }), ...(status && { status }) },
      take: limit ?? 100,
      orderBy: { rating: "desc" },
    }));
  })
);

router.get(
  "/active",
  validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }) }),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 1);
    const dealers = await prisma.dealer.findMany({
      where: { isActive: true, status: "active" },
      take: limit,
      orderBy: { rating: "desc" },
    });
    res.json(limit === 1 ? dealers[0] ?? null : dealers);
  })
);

router.get(
  "/search",
  validate({
    query: z.object({
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      radius_km: z.coerce.number().positive().max(500).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { lat, lng, city, state } = req.query as any;
    const limit = Number(req.query.limit ?? 25);
    const radius = Number(req.query.radius_km ?? 50);
    const origin = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;

    const dealers = await prisma.dealer.findMany({
      where: { isActive: true, status: "active", ...(city && { city }), ...(state && { state }) },
      take: 100,
      orderBy: { rating: "desc" },
    });

    const results = dealers
      .map((d) => {
        const distance = origin && d.lat != null && d.lng != null ? distanceKm(origin, { lat: d.lat, lng: d.lng }) : undefined;
        return {
          id: d.id,
          name: d.name,
          address: d.address ?? "",
          city: d.city ?? "",
          state: d.state ?? "",
          pincode: d.pincode ?? "",
          phone: d.phone ?? "",
          lat: d.lat ?? 0,
          lng: d.lng ?? 0,
          rating: d.rating,
          total_reviews: d.totalReviews,
          brands: Array.isArray(d.brands) ? d.brands : [],
          supported_oems: Array.isArray(d.brands) ? d.brands : [],
          supported_services: Array.isArray(d.services) ? d.services : [],
          pickup_radius_km: 0,
          live_capacity: 0,
          workshop_type: d.workshopType ?? "multi_brand",
          total_bays: 0,
          is_pickup_available: d.isPickupEnabled,
          next_available_slot: "",
          open_time: d.openTime ?? "",
          close_time: d.closeTime ?? "",
          distance_km: distance,
        };
      })
      .filter((d) => d.distance_km == null || d.distance_km <= radius)
      .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity) || b.rating - a.rating)
      .slice(0, limit);

    res.json({ results, query: req.query, total: results.length, method: origin ? "geo" : city ? "city" : "broad" });
  })
);

router.get("/:id", asyncHandler(async (req, res) => {
  const d = await prisma.dealer.findUnique({ where: { id: req.params.id } });
  if (!d) return res.status(404).json({ error: "Dealer not found" });
  res.json(d);
}));

router.post(
  "/",
  requireAuth,
  requireRole("admin", "dealer"),
  validate({
    body: z.object({
      name: z.string().min(2).max(160),
      ownerId: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      gstNumber: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      isEvCapable: z.boolean().optional(),
      isRsaEnabled: z.boolean().optional(),
      isPickupEnabled: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => res.status(201).json(await prisma.dealer.create({ data: req.body })))
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "dealer"),
  asyncHandler(async (req, res) => {
    res.json(await prisma.dealer.update({ where: { id: req.params.id }, data: req.body }));
  })
);

export default router;
