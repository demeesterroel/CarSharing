import { PageHeader } from "@/components/page-header";
import { t } from "@/lib/i18n";

export default function HomePage() {
  return (
    <>
      <PageHeader title={t("page.dashboard")} />
      <main className="p-4">
        <p className="text-gray-500">{t("page.dashboard_coming_soon")}</p>
      </main>
    </>
  );
}
