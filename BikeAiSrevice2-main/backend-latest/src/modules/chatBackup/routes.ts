import { NextFunction, Response, Router } from "express";
import { Prisma } from "@prisma/client";

import { AuthedRequest } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { verifyToken } from "../../utils/jwt";
import {
  chatBackupDeleteParamsSchema,
  chatBackupHistoryQuerySchema,
  chatMemoryBodySchema,
  chatMemoryQuerySchema,
  saveChatBackupMessageSchema,
} from "./schemas";
import {
  deleteChatBackupSession,
  firstString,
  getChatBackupHistory,
  listChatMemory,
  normalizeChatBackupHistoryInput,
  normalizeSaveChatBackupInput,
  saveChatBackupMessage,
  saveChatMemory,
  type ChatMemoryKind,
} from "./service";

export const chatBackupRouter = Router();
export const chatBackupLegacyRouter = Router();
export const crmChatMemoryRouter = Router();
export const serviceManagerChatMemoryRouter = Router();

function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // Chat backups can still be written by anonymous public widgets.
    }
  }
  next();
}

const getHistory = asyncHandler<AuthedRequest>(async (req, res) => {
  const history = await getChatBackupHistory(
    normalizeChatBackupHistoryInput(req.query as Record<string, unknown>, req.user?.sub),
  );
  res.json(history);
});

const postMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  const saved = await saveChatBackupMessage(
    normalizeSaveChatBackupInput(req.body as Record<string, unknown>, req.user?.sub),
  );
  res.status(201).json(saved);
});

const deleteSession = asyncHandler(async (req, res) => {
  await deleteChatBackupSession(req.params.id).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return;
    throw err;
  });
  res.status(204).send();
});

function registerChatBackupRoutes(router: Router, historyPath: string, deletePath: string) {
  router.use(optionalAuth);
  router.post("/messages", validate({ body: saveChatBackupMessageSchema }), postMessage);
  router.get(historyPath, validate({ query: chatBackupHistoryQuerySchema }), getHistory);
  router.delete(deletePath, validate({ params: chatBackupDeleteParamsSchema }), deleteSession);
}

function registerMemoryRoutes(router: Router, kind: ChatMemoryKind) {
  router.use(optionalAuth);

  router.get(
    "/chat-memory",
    validate({ query: chatMemoryQuerySchema }),
    asyncHandler(async (req, res) => {
      const query = req.query as Record<string, unknown>;
      const rows = await listChatMemory(kind, {
        serviceCenterId: firstString(query.serviceCenterId, query.service_center_id),
        customerId: firstString(query.customerId, query.customer_id),
        limit: typeof query.limit === "number" ? query.limit : undefined,
      });
      res.json(rows);
    }),
  );

  router.post(
    "/chat-memory",
    validate({ body: chatMemoryBodySchema }),
    asyncHandler<AuthedRequest>(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const customerId = firstString(body.customer_id);
      const serviceCenterId = firstString(body.service_center_id);
      const summary = firstString(body.summary);
      if (!customerId || !serviceCenterId) {
        throw ApiError.badRequest("customer_id and service_center_id are required");
      }
      if (!summary) throw ApiError.badRequest("summary is required");

      const row = await saveChatMemory(kind, {
        customerId,
        serviceCenterId,
        jobCardId: firstString(body.job_card_id),
        conversationSource: firstString(body.conversation_source),
        visibility: firstString(body.visibility),
        tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
        summary,
        rawExcerpt: firstString(body.raw_excerpt),
        sentiment: firstString(body.sentiment),
        createdBy: firstString(body.created_by, req.user?.sub),
      });

      res.status(201).json(row);
    }),
  );
}

registerChatBackupRoutes(chatBackupRouter, "/history", "/sessions/:id");
registerChatBackupRoutes(chatBackupLegacyRouter, "/", "/:id");
registerMemoryRoutes(crmChatMemoryRouter, "crm");
registerMemoryRoutes(serviceManagerChatMemoryRouter, "service_manager");

export const chatBackupsRouter = chatBackupLegacyRouter;
