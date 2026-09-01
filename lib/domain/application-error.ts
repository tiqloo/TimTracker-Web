export type ApplicationErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly httpStatus: 400 | 401 | 403 | 404;
  readonly publicMessage: string;

  constructor(
    code: ApplicationErrorCode,
    httpStatus: 400 | 401 | 403 | 404,
    publicMessage: string,
  ) {
    super(publicMessage);
    this.code = code;
    this.httpStatus = httpStatus;
    this.publicMessage = publicMessage;
    this.name = "ApplicationError";
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = "The request is invalid.") {
    super("VALIDATION_ERROR", 400, message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor() {
    super("UNAUTHORIZED", 401, "Authentication required.");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = "Access denied.") {
    super("FORBIDDEN", 403, message);
    this.name = "ForbiddenError";
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor(resource = "Resource") {
    super("RESOURCE_NOT_FOUND", 404, `${resource} was not found or is not accessible.`);
    this.name = "ResourceNotFoundError";
  }
}
