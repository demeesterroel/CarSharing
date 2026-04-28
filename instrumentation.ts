export async function register() {
  // Validate required environment variables at startup.
  // This import throws a clear Zod error if any required var is missing.
  await import("./lib/env");
}
