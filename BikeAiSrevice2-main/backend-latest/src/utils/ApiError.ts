export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg = "Bad request", details?: unknown) { return new ApiError(400, msg, details); }
  static unauthorized(msg = "Unauthorized") { return new ApiError(401, msg); }
  static forbidden(msg = "Forbidden") { return new ApiError(403, msg); }
  static notFound(msg = "Not found") { return new ApiError(404, msg); }
  static conflict(msg = "Conflict") { return new ApiError(409, msg); }
}
