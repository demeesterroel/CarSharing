"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { apiFetch } from "@/lib/api/client";
import type { Person } from "@/types";

export default function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const t = useT();
  const { data: me, isLoading: meLoading } = useMe();
  const [id, setId] = useState<number | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    params.then(({ id: rawId }) => {
      const n = Number(rawId);
      setId(n);
    });
  }, [params]);

  useEffect(() => {
    if (id === null) return;
    fetch(`/api/people/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Niet gevonden");
        return r.json() as Promise<Person>;
      })
      .then((p) => {
        setPerson(p);
        setName(p.name);
        setBankAccount(p.bank_account ?? "");
        setEmail(p.email ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const canEdit = me != null && id != null && (me.personId === id || me.isAdmin);

  if (meLoading || loading) {
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.profile_edit")} />
      </div>
    );
  }

  if (!canEdit || !person) {
    return (
      <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
        <PageHeader title={t("page.profile_edit")} />
        <div style={{ padding: 24, fontFamily: fontMono, fontSize: 12, color: paper.accent }}>
          {!canEdit ? t("error.no_access") : t("error.not_found")}
        </div>
      </div>
    );
  }

  const dirty =
    name !== person.name ||
    bankAccount !== (person.bank_account ?? "") ||
    email !== (person.email ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/people/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bank_account: bankAccount, email: email || null }),
      });
      setSaved(true);
      setTimeout(() => router.push("/"), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader title={t("page.profile_edit")} />

      <div style={{ padding: 16 }}>
        <div
          style={{
            background: paper.paper,
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: fontSerif,
              fontSize: 14,
              fontWeight: 700,
              color: paper.ink,
              marginBottom: 16,
            }}
          >
            {person.name}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="edit-username"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.username")}
              </label>
              <input
                id="edit-username"
                type="text"
                value={person.username ?? ""}
                readOnly
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDeep,
                  color: paper.inkMute,
                  border: `1.5px solid ${paper.paperDeep}`,
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "default",
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="edit-name"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.full_name")}
              </label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDark,
                  color: paper.ink,
                  border: `1.5px solid ${name !== person.name ? paper.ink : paper.paperDark}`,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="edit-bank"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.bank_account")}
              </label>
              <input
                id="edit-bank"
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="BE00 0000 0000 0000"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDark,
                  color: paper.ink,
                  border: `1.5px solid ${bankAccount !== (person.bank_account ?? "") ? paper.ink : paper.paperDark}`,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="edit-email"
                style={{
                  display: "block",
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t("form.email")}
              </label>
              <input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.be"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontFamily: fontMono,
                  fontSize: 12,
                  background: paper.paperDark,
                  color: paper.ink,
                  border: `1.5px solid ${email !== (person.email ?? "") ? paper.ink : paper.paperDark}`,
                  outline: "none",
                  boxSizing: "border-box",
                  letterSpacing: 1,
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 10,
                  color: paper.accent,
                  marginBottom: 10,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!dirty || saving}
              style={{
                width: "100%",
                padding: "8px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                background: saved ? paper.green : dirty ? paper.ink : paper.paperDark,
                color: dirty || saved ? paper.paper : paper.inkMute,
                border: "none",
                cursor: dirty && !saving ? "pointer" : "default",
              }}
            >
              {saved ? t("action.saved") : saving ? t("action.saving") : t("action.save")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
