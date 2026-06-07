import { z } from "zod";

const nullableString = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    }
    return value;
  }, z.string().min(1).max(191).optional().nullable());

const optionalText = (max = 191) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    }
    return value;
  }, z.string().min(1).max(max).optional());

const jsonPayload = z.unknown().optional().nullable();

export const saveChatBackupMessageSchema = z
  .object({
    sessionId: nullableString,
    session_id: nullableString,
    sessionKey: nullableString,
    session_key: nullableString,
    source: optionalText(80),
    conversation_source: optionalText(80),
    chatbotType: optionalText(80),
    chatbot_type: optionalText(80),
    sender: z.enum(["user", "assistant"]),
    message: z.string().min(1).max(20_000),
    userId: nullableString,
    user_id: nullableString,
    customerId: nullableString,
    customer_id: nullableString,
    location: jsonPayload,
    locationPayload: jsonPayload,
    location_payload: jsonPayload,
  })
  .passthrough();

export const chatBackupHistoryQuerySchema = z
  .object({
    sessionId: nullableString,
    session_id: nullableString,
    sessionKey: nullableString,
    session_key: nullableString,
    source: optionalText(80),
    chatbotType: optionalText(80),
    chatbot_type: optionalText(80),
    userId: nullableString,
    user_id: nullableString,
    customerId: nullableString,
    customer_id: nullableString,
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .passthrough();

export const chatBackupDeleteParamsSchema = z.object({
  id: z.string().min(1).max(191),
});

export const chatMemoryBodySchema = z
  .object({
    job_card_id: nullableString,
    customer_id: nullableString,
    service_center_id: nullableString,
    conversation_source: optionalText(80),
    visibility: optionalText(40),
    tags: z.array(z.string().max(80)).optional(),
    summary: z.string().min(1).max(2_000),
    raw_excerpt: z.string().max(20_000).optional().nullable(),
    sentiment: z.string().max(40).optional().nullable(),
    created_by: nullableString,
  })
  .passthrough();

export const chatMemoryQuerySchema = z
  .object({
    serviceCenterId: nullableString,
    service_center_id: nullableString,
    customerId: nullableString,
    customer_id: nullableString,
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .passthrough();

export type SaveChatBackupMessageBody = z.infer<typeof saveChatBackupMessageSchema>;
export type ChatBackupHistoryQuery = z.infer<typeof chatBackupHistoryQuerySchema>;
export type ChatMemoryBody = z.infer<typeof chatMemoryBodySchema>;
export type ChatMemoryQuery = z.infer<typeof chatMemoryQuerySchema>;
