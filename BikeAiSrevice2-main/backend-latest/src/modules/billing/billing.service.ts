import { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

function nextInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `INV-${ts}-${rnd}`;
}

export const BillingService = {
  list: (filters: { dealerId?: string; customerId?: string; status?: InvoiceStatus }) =>
    prisma.invoice.findMany({
      where: filters,
      include: { customer: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),

  async get(id: string) {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, dealer: true, jobCard: { include: { items: true } }, payments: true },
    });
    if (!inv) throw ApiError.notFound("Invoice");
    return inv;
  },

  async createFromJobCard(jobCardId: string, opts: { discount?: number } = {}) {
    const jc = await prisma.jobCard.findUnique({ where: { id: jobCardId }, include: { items: true, invoice: true } });
    if (!jc) throw ApiError.notFound("Job card");
    if (jc.invoice) throw ApiError.conflict("Invoice already exists for this job card");

    let subtotal = new Prisma.Decimal(0);
    let tax = new Prisma.Decimal(0);
    for (const it of jc.items) {
      const qty = new Prisma.Decimal(it.quantity);
      const price = new Prisma.Decimal(it.unitPrice);
      const lineSub = qty.mul(price);
      subtotal = subtotal.plus(lineSub);
      tax = tax.plus(lineSub.mul(new Prisma.Decimal(it.taxPercent)).div(100));
    }
    const discount = new Prisma.Decimal(opts.discount ?? 0);
    const total = subtotal.plus(tax).minus(discount);

    return prisma.invoice.create({
      data: {
        number: nextInvoiceNumber(),
        jobCardId,
        dealerId: jc.dealerId,
        customerId: jc.customerId,
        subtotal, taxAmount: tax, discount, total,
        status: "issued",
        issuedAt: new Date(),
      },
    });
  },

  async addPayment(invoiceId: string, amount: number, method: PaymentMethod, reference?: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { invoiceId, amount: new Prisma.Decimal(amount), method, reference },
      });
      const agg = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (invoice && agg._sum.amount && new Prisma.Decimal(agg._sum.amount).gte(invoice.total)) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: "paid" } });
      }
      return payment;
    });
  },
};
