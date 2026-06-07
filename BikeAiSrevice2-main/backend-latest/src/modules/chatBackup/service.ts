import { Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

type ChatBackupSenderValue = "user" | "assistant";

export interface SaveChatBackupInput {
  sessionId?: string;
  sessionKey?: string;
  source: string;
  chatbotType: string;
  sender: ChatBackupSenderValue;
  message: string;
  userId?: string;
  customerId?: string;
  location?: unknown;
}

export interface ChatBackupHistoryInput {
  sessionId?: string;
  sessionKey?: string;
  source?: string;
  chatbotType?: string;
  userId?: string;
  customerId?: string;
  limit?: number;
}

export type ChatMemoryKind = "crm" | "service_manager";

export interface SaveChatMemoryInput {
  customerId: string;
  serviceCenterId: string;
  jobCardId?: string;
  conversationSource?: string;
  visibility?: string;
  tags?: string[];
  summary: string;
  rawExcerpt?: string;
  sentiment?: string;
  createdBy?: string;
}

export function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null);
}

function asNullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function sessionCreateData(input: SaveChatBackupInput): Prisma.ChatBackupSessionCreateInput {
  if (!input.sessionKey) throw ApiError.badRequest("sessionKey is required to create a chat backup session");
  return {
    sessionKey: input.sessionKey,
    source: input.source,
    chatbotType: input.chatbotType,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
  };
}

function sessionUpdateData(input: SaveChatBackupInput): Prisma.ChatBackupSessionUpdateInput {
  return {
    source: input.source,
    chatbotType: input.chatbotType,
    updatedAt: new Date(),
    ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
  };
}

export async function saveChatBackupMessage(input: SaveChatBackupInput) {
  if (!input.message.trim()) throw ApiError.badRequest("Message is required");
  if (!input.sessionId && !input.sessionKey) {
    throw ApiError.badRequest("sessionKey is required when sessionId is not provided");
  }

  return prisma.$transaction(async (tx) => {
    let session = input.sessionId
      ? await tx.chatBackupSession.findUnique({ where: { id: input.sessionId } })
      : null;

    if (session) {
      session = await tx.chatBackupSession.update({
        where: { id: session.id },
        data: sessionUpdateData(input),
      });
    } else if (input.sessionKey) {
      session = await tx.chatBackupSession.upsert({
        where: { sessionKey: input.sessionKey },
        create: sessionCreateData(input),
        update: sessionUpdateData(input),
      });
    } else {
      throw ApiError.notFound("Chat backup session not found");
    }

    const location = asNullableJson(input.location);
    const messageData: Prisma.ChatBackupMessageUncheckedCreateInput = {
      sessionId: session.id,
      sender: input.sender,
      message: input.message,
      ...(location !== undefined ? { location } : {}),
    };

    const message = await tx.chatBackupMessage.create({ data: messageData });
    return { session, message };
  });
}

export async function getChatBackupHistory(input: ChatBackupHistoryInput) {
  if (!input.sessionId && !input.sessionKey && !input.userId && !input.customerId) {
    return { session: null, messages: [], total: 0 };
  }

  const session = await prisma.chatBackupSession.findFirst({
    where: {
      ...(input.sessionId ? { id: input.sessionId } : {}),
      ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.chatbotType ? { chatbotType: input.chatbotType } : {}),
      ...(!input.sessionId && !input.sessionKey && input.customerId ? { customerId: input.customerId } : {}),
      ...(!input.sessionId && !input.sessionKey && !input.customerId && input.userId ? { userId: input.userId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!session) return { session: null, messages: [], total: 0 };

  const messages = await prisma.chatBackupMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: input.limit ? "desc" : "asc" },
    ...(input.limit ? { take: input.limit } : {}),
  });

  const orderedMessages = input.limit ? messages.reverse() : messages;
  return { session, messages: orderedMessages, total: orderedMessages.length };
}

export async function deleteChatBackupSession(id: string) {
  await prisma.chatBackupSession.delete({ where: { id } });
}

export function normalizeSaveChatBackupInput(body: Record<string, unknown>, authUserId?: string): SaveChatBackupInput {
  return {
    sessionId: firstString(body.sessionId, body.session_id),
    sessionKey: firstString(body.sessionKey, body.session_key),
    source: firstString(body.source, body.conversation_source) ?? "chatbot",
    chatbotType: firstString(body.chatbotType, body.chatbot_type) ?? "assistant",
    sender: firstString(body.sender) as ChatBackupSenderValue,
    message: String(body.message ?? ""),
    userId: firstString(body.userId, body.user_id, authUserId),
    customerId: firstString(body.customerId, body.customer_id),
    location: firstDefined(body.location, body.locationPayload, body.location_payload),
  };
}

export function normalizeChatBackupHistoryInput(query: Record<string, unknown>, authUserId?: string): ChatBackupHistoryInput {
  return {
    sessionId: firstString(query.sessionId, query.session_id),
    sessionKey: firstString(query.sessionKey, query.session_key),
    source: firstString(query.source),
    chatbotType: firstString(query.chatbotType, query.chatbot_type),
    userId: firstString(query.userId, query.user_id, authUserId),
    customerId: firstString(query.customerId, query.customer_id),
    limit: typeof query.limit === "number" ? query.limit : undefined,
  };
}

function memoryScope(kind: ChatMemoryKind) {
  return {
    source: `${kind}_chat_memory`,
    chatbotType: kind === "crm" ? "crm" : "service_manager",
  };
}

export async function listChatMemory(kind: ChatMemoryKind, params: { customerId?: string; serviceCenterId?: string; limit?: number }) {
  const scope = memoryScope(kind);
  const limit = params.limit ?? 100;
  const rows = await prisma.chatBackupMessage.findMany({
    where: {
      session: {
        source: scope.source,
        chatbotType: scope.chatbotType,
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
    },
    include: { session: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit * 3, 300),
  });

  return rows
    .map(toMemoryRow)
    .filter((row) => !params.serviceCenterId || row.service_center_id === params.serviceCenterId)
    .slice(0, limit);
}

export async function saveChatMemory(kind: ChatMemoryKind, input: SaveChatMemoryInput) {
  const scope = memoryScope(kind);
  const metadata = {
    job_card_id: input.jobCardId ?? null,
    service_center_id: input.serviceCenterId,
    conversation_source: input.conversationSource ?? "chatbot",
    visibility: input.visibility ?? "internal",
    tags: input.tags ?? [],
    summary: input.summary,
    raw_excerpt: input.rawExcerpt ?? input.summary,
    sentiment: input.sentiment ?? "neutral",
    created_by: input.createdBy ?? null,
  };

  const saved = await saveChatBackupMessage({
    sessionKey: `${scope.source}:${input.serviceCenterId}:${input.customerId}:${input.jobCardId ?? "customer"}`,
    source: scope.source,
    chatbotType: scope.chatbotType,
    sender: "assistant",
    message: metadata.raw_excerpt,
    userId: input.createdBy,
    customerId: input.customerId,
    location: metadata,
  });

  return toMemoryRow({ ...saved.message, session: saved.session });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toMemoryRow(row: {
  id: string;
  message: string;
  location: Prisma.JsonValue | null;
  createdAt: Date;
  session: { customerId: string | null };
}) {
  const meta = asObject(row.location);
  return {
    id: row.id,
    job_card_id: firstString(meta.job_card_id) ?? null,
    customer_id: row.session.customerId ?? "",
    service_center_id: firstString(meta.service_center_id) ?? "",
    conversation_source: firstString(meta.conversation_source) ?? "chatbot",
    visibility: firstString(meta.visibility) ?? "internal",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    summary: firstString(meta.summary) ?? row.message.slice(0, 220),
    raw_excerpt: firstString(meta.raw_excerpt) ?? row.message,
    sentiment: firstString(meta.sentiment) ?? "neutral",
    created_at: row.createdAt.toISOString(),
  };
}
