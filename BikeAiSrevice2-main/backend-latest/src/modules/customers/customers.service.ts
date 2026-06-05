import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export const CustomersService = {
  list: (q: { search?: string; take?: number; skip?: number }) =>
    prisma.customer.findMany({
      where: q.search
        ? {
            OR: [
              { fullName: { contains: q.search } },
              { phone: { contains: q.search } },
              { email: { contains: q.search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: q.take ?? 50,
      skip: q.skip ?? 0,
      include: { vehicles: true },
    }),

  get: async (id: string) => {
    const c = await prisma.customer.findUnique({
      where: { id },
      include: { vehicles: true, bookings: { take: 20, orderBy: { createdAt: "desc" } } },
    });
    if (!c) throw ApiError.notFound("Customer");
    return c;
  },

  create: (data: { fullName: string; phone: string; email?: string; city?: string; pincode?: string; address?: string; userId?: string }) =>
    prisma.customer.create({ data: { ...data, userId: data.userId ?? "" } as any }),

  update: (id: string, data: Partial<{ fullName: string; phone: string; email: string; city: string; pincode: string; address: string; preferredDealerId: string }>) =>
    prisma.customer.update({ where: { id }, data }),

  remove: (id: string) => prisma.customer.delete({ where: { id } }),
};
