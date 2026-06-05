import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

export const validate = (schema: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body)   req.body   = schema.body.parse(req.body);
      if (schema.query)  req.query  = schema.query.parse(req.query) as any;
      if (schema.params) req.params = schema.params.parse(req.params) as any;
      next();
    } catch (err) { next(err); }
  };
