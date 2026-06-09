import type { MessageKey } from "@/lib/i18n/messages/nl";

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Builds a ready-to-send invite message for copy-to-clipboard.
 * Mirrors the wording of the emailed invite (see app/api/people/[id]/invite/route.ts).
 *
 * @param username - The member's username; if null/empty, the username line is omitted.
 * @param url      - The invite URL.
 * @param t        - Localisation function (useT hook value or static t).
 */
export function buildInviteMessage(
  username: string | null,
  url: string,
  t: TFn,
): string {
  const lines: string[] = [t("admin.invite_msg_intro"), ""];

  if (username) {
    lines.push(t("admin.invite_msg_username", { username }), "");
  }

  lines.push(t("admin.invite_msg_cta"), url);

  return lines.join("\n");
}
