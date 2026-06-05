import twilio from "twilio";
import { prisma } from "../../config/prisma";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestCustomerOtp(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.customerOtp.create({
    data: {
      phone: normalizedPhone,
      code,
      expiresAt,
    },
  });

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${normalizedPhone}`,
    body: `Your BikeAI OTP is ${code}. It expires in 5 minutes.`,
  });

  return { success: true };
}

export async function verifyCustomerOtp(phone: string, code: string) {
  const normalizedPhone = normalizePhone(phone);

  const otp = await prisma.customerOtp.findFirst({
    where: {
      phone: normalizedPhone,
      verifiedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otp) {
    throw new Error("OTP not found");
  }

  if (otp.expiresAt < new Date()) {
    throw new Error("OTP expired");
  }

  if (otp.code !== code) {
    throw new Error("Invalid OTP");
  }

  await prisma.customerOtp.update({
    where: { id: otp.id },
    data: { verifiedAt: new Date() },
  });

  return { success: true };
}
