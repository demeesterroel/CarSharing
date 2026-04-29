import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

interface Credentials {
  username: string;
  password: string;
}

interface StoredCredentials {
  username: string;
  passwordHash: string;
}

/**
 * Verifies login credentials using constant-time comparisons to prevent timing attacks.
 * @param input - Supplied username and password.
 * @param stored - Stored username and bcrypt password hash.
 * @returns `true` if both username and password match.
 */
// Both comparisons always run regardless of whether the username matched.
// Bailing out early on a username mismatch would leak which field was wrong
// via response timing.
export async function verifyCredentials(
  input: Credentials,
  stored: StoredCredentials
): Promise<boolean> {
  const maxLen = Math.max(Buffer.byteLength(input.username), Buffer.byteLength(stored.username));
  const a = Buffer.alloc(maxLen);
  const b = Buffer.alloc(maxLen);
  Buffer.from(input.username).copy(a);
  Buffer.from(stored.username).copy(b);
  const usernameMatch = timingSafeEqual(a, b);

  const passwordMatch = await bcrypt.compare(input.password, stored.passwordHash);
  return usernameMatch && passwordMatch;
}
