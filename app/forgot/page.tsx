import { isMailEnabled } from "@/lib/mailer";
import ForgotForm from "./forgot-form";

// Read mail config at request time, not build time: production enables delivery
// by setting a transport (RESEND_API_KEY or MAIL_WEBHOOK_URL — #277) without a
// rebuild, and the form's availability must reflect that live.
export const dynamic = "force-dynamic";

/**
 * Server wrapper for the password-reset request page. It reads the server-only
 * mail config and tells the client form whether reset / magic-link delivery is
 * actually wired up (see #277). The form disables itself with a notice when not.
 */
export default function ForgotPasswordPage() {
  return <ForgotForm mailEnabled={isMailEnabled()} />;
}
