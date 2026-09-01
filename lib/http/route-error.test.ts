import assert from "node:assert/strict";
import test from "node:test";
import {
  ForbiddenError,
  ResourceNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../domain/application-error.ts";
import { routeErrorResponse } from "./route-error.ts";

const cases = [
  [new ValidationError("Invalid range."), 400, "VALIDATION_ERROR"],
  [new UnauthorizedError(), 401, "UNAUTHORIZED"],
  [new ForbiddenError(), 403, "FORBIDDEN"],
  [new ResourceNotFoundError("Project"), 404, "RESOURCE_NOT_FOUND"],
] as const;

for (const [error, status, code] of cases) {
  test(`routeErrorResponse maps ${code} to HTTP ${status}`, async () => {
    const response = routeErrorResponse(error, "test_operation", "correlation-1");
    assert.equal(response.status, status);
    assert.equal(response.headers.get("x-correlation-id"), "correlation-1");
    assert.deepEqual(await response.json(), {
      error: { code, message: error.publicMessage, correlationId: "correlation-1" },
    });
  });
}

test("routeErrorResponse hides unexpected details and logs metadata only", async () => {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => calls.push(args);
  try {
    const response = routeErrorResponse(
      new Error("jwt=secret export={personal-data}"),
      "data_export",
      "correlation-2",
    );
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.doesNotMatch(body, /secret|personal-data|jwt/);
    assert.equal(response.headers.get("x-correlation-id"), "correlation-2");
    assert.equal(JSON.stringify(calls).includes("secret"), false);
    assert.deepEqual(calls, [[{
      event: "route_error",
      operation: "data_export",
      correlationId: "correlation-2",
      errorType: "Error",
    }]]);
  } finally {
    console.error = original;
  }
});

test("routeErrorResponse generates one valid correlation ID for header, body and log", async () => {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => calls.push(args);
  try {
    const response = routeErrorResponse("provider response", "history_export");
    const correlationId = response.headers.get("x-correlation-id");
    assert.ok(correlationId);
    assert.match(correlationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.deepEqual(await response.json(), {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        correlationId,
      },
    });
    assert.deepEqual(calls, [[{
      event: "route_error",
      operation: "history_export",
      correlationId,
      errorType: "string",
    }]]);
  } finally {
    console.error = original;
  }
});
