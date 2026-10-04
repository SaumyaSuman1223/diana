/** Expected failures a caller (UI, assistant) can act on. Anything else is a bug. */
export class DomainError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (what: string, id: string) => new DomainError("not_found", `${what} ${id} not found`);
export const invalid = (message: string) => new DomainError("invalid", message);
