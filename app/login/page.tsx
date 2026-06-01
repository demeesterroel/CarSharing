import { isMailEnabled } from "@/lib/mailer";
import LoginForm from "./login-form";

// Read mail config at request time so the magic-link option appears as soon as a
// transport is configured (#277), without a rebuild.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm mailEnabled={isMailEnabled()} />;
}
