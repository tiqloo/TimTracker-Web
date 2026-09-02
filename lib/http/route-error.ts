import { ApplicationError } from "../domain/application-error.ts";

interface RouteErrorBody {
  error: {
    code: string;
    message: string;
    correlationId: string;
  };
}

export function routeErrorResponse(
  error: unknown,
  operation: string,
  correlationId: string = crypto.randomUUID(),
): Response {
  const expected = error instanceof ApplicationError;
  const status = expected ? error.httpStatus : 500;
  const body: RouteErrorBody = {
    error: {
      code: expected ? error.code : "INTERNAL_ERROR",
      message: expected ? error.publicMessage : "An unexpected error occurred.",
      correlationId,
    },
  };

  if (!expected) {
    // Deliberately log metadata only. Error messages/stacks can contain raw
    // provider responses or user/export data and must not enter server logs.
    console.error({
      event: "route_error",
      operation,
      correlationId,
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }

  return Response.json(body, {
    status,
    headers: { "x-correlation-id": correlationId },
  });
}
