import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export const BookingsService = {
  list(filters: { dealerId?: string; customerId?: string; status?: BookingStatus; from?: Date; to?: Date }) {
    const where: Prisma.BookingWhereInput = {
      ...(filters.dealerId && { dealerId: filters.dealerId }),
      ...(filters.customerId && { customerId: filters.customerId }),
      ...(filters.status && { status: filters.status }),
      ...((filters.from || filters.to) && {
        scheduledAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) },
      }),
    };
    return prisma.booking.findMany({
      where,
      include: { customer: true, vehicle: true, dealer: true },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    });
  },

  async get(id: string) {
    const b = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true, vehicle: true, dealer: true, jobCard: true, timeline: { orderBy: { createdAt: "asc" } } },
    });
    if (!b) throw ApiError.notFound("Booking");
    return b;
  },

  async create(data: {
    customerId: string; dealerId: string; vehicleId?: string;
    serviceType: string; scheduledAt: Date; notes?: string; reportedIssues?: unknown;
  }) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({ data: { ...data, reportedIssues: data.reportedIssues as any } });
      await tx.bookingTimeline.create({ data: { bookingId: booking.id, event: "created", note: "Booking created" } });
      return booking;
    });
  },

  async updateStatus(id: string, status: BookingStatus, actorId?: string, note?: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({ where: { id }, data: { status } });
      await tx.bookingTimeline.create({ data: { bookingId: id, event: `status:${status}`, note, actorId } });
      return booking;
    });
  },

  cancel: (id: string, actorId?: string) =>
    BookingsService.updateStatus(id, "cancelled", actorId, "Cancelled by user"),
};
