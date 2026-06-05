import { JobCardStatus, JobItemKind, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

function nextJobNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `JC-${ts}-${rnd}`;
}

export interface CreateJobCardInput {
  bookingId?: string;
  dealerId: string;
  customerId: string;
  vehicleId: string;
  advisorId?: string;
  complaint?: string;
  odometerKm?: number;
  fuelLevel?: string;
  priority?: number;
  estimatedReady?: Date;
}

export interface JobItemInput {
  kind: JobItemKind;
  name: string;
  partNumber?: string;
  quantity?: number;
  unitPrice: number;
  taxPercent?: number;
}

export const JobCardsService = {
  list: (filters: { dealerId?: string; status?: JobCardStatus; technicianId?: string }) =>
    prisma.jobCard.findMany({
      where: { ...filters },
      include: { customer: true, vehicle: true, items: true, technician: true, advisor: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),

  async get(id: string) {
    const jc = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        customer: true, vehicle: true, dealer: true,
        technician: true, advisor: true,
        items: true, approvals: { orderBy: { createdAt: "desc" } },
        invoice: { include: { payments: true } },
      },
    });
    if (!jc) throw ApiError.notFound("Job card");
    return jc;
  },

  create: (data: CreateJobCardInput) =>
    prisma.jobCard.create({
      data: { ...data, number: nextJobNumber() },
      include: { items: true },
    }),

  async updateStatus(id: string, status: JobCardStatus) {
    return prisma.jobCard.update({
      where: { id },
      data: { status, ...(status === "delivered" ? { closedAt: new Date() } : {}) },
    });
  },

  assignTechnician: (id: string, technicianId: string) =>
    prisma.jobCard.update({ where: { id }, data: { technicianId } }),

  async addItem(jobCardId: string, input: JobItemInput) {
    const qty = new Prisma.Decimal(input.quantity ?? 1);
    const price = new Prisma.Decimal(input.unitPrice);
    const tax = new Prisma.Decimal(input.taxPercent ?? 0);
    const lineSubtotal = qty.mul(price);
    const total = lineSubtotal.plus(lineSubtotal.mul(tax).div(100));

    return prisma.$transaction(async (tx) => {
      const item = await tx.jobCardItem.create({
        data: { jobCardId, kind: input.kind, name: input.name, partNumber: input.partNumber,
          quantity: qty, unitPrice: price, taxPercent: tax, total },
      });
      const agg = await tx.jobCardItem.aggregate({ where: { jobCardId }, _sum: { total: true } });
      await tx.jobCard.update({ where: { id: jobCardId }, data: { estimateTotal: agg._sum.total ?? 0 } });
      return item;
    });
  },

  removeItem: (itemId: string) => prisma.jobCardItem.delete({ where: { id: itemId } }),

  requestApproval: (jobCardId: string, description: string, estimate: number, mediaUrls: string[] = []) =>
    prisma.additionalWorkApproval.create({
      data: { jobCardId, description, estimate, mediaUrls, channel: "whatsapp" },
    }),

  decideApproval: (id: string, approved: boolean) =>
    prisma.additionalWorkApproval.update({
      where: { id },
      data: { status: approved ? "approved" : "rejected", approvedAt: approved ? new Date() : null },
    }),
};
