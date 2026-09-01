import { ResourceNotFoundError } from "../../domain/application-error.ts";

export function requireUpdatedRow<Row>(
  row: Row | null,
  resource: string,
): Row {
  if (row === null) throw new ResourceNotFoundError(resource);
  return row;
}
