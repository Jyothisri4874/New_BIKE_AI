import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { signToken } from "../../utils/jwt";
import { ApiError } from "../../utils/ApiError";
import { UserRole } from "@prisma/client";

export interface RegisterInput {
  email?: string;
  phone?: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export const AuthService = {
  async register(input: RegisterInput) {
    if (!input.email && !input.phone) throw ApiError.badRequest("email or phone required");
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email ?? undefined }, { phone: input.phone ?? undefined }] },
    });
    if (existing) throw ApiError.conflict("User already exists");

    const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);
    const role = input.role ?? "customer";

    const user = await prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        fullName: input.fullName,
        role,
        ...(role === "customer" && {
          customer: { create: { fullName: input.fullName, phone: input.phone ?? "" } },
        }),
      },
      include: { customer: true },
    });

    return { user: sanitize(user), token: signToken({ sub: user.id, role: user.role }) };
  },

  async login(identifier: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid credentials");
    if (!user.isActive) throw ApiError.forbidden("Account disabled");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw ApiError.unauthorized("Invalid credentials");

    return {
      user: sanitize(user),
      token: signToken({ sub: user.id, role: user.role, dealerId: user.staffOfDealerId ?? null }),
    };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true, staffOfDealer: true },
    });
    if (!user) throw ApiError.notFound("User");
    return sanitize(user);
  },
};

function sanitize<T extends { passwordHash?: string | null }>(u: T) {
  const { passwordHash: _ph, ...rest } = u as any;
  return rest;
}
