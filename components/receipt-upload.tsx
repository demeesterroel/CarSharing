"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

interface Props {
  value: string | null;
  onChange: (path: string) => void;
}

/** Read the double-submit CSRF token from the cookie for the upload request. */
function getCsrfToken(): string {
  return document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/)?.[1] ?? "";
}

export function ReceiptUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      onChange(data.path);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="border rounded-md p-3 flex flex-col items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={t("form.receipt")}
              className="max-h-32 rounded object-contain cursor-zoom-in"
              onClick={() => setLightbox(true)}
            />
            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? t("state.uploading") : t("form.receipt_replace")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <Camera
              className={`w-6 h-6 ${uploading ? "animate-pulse text-blue-500" : "text-gray-400"}`}
            />
            <span className="text-xs text-gray-500">
              {uploading ? t("state.uploading") : t("form.receipt_add")}
            </span>
          </button>
        )}
      </div>

      {lightbox && value && (
        <div
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label={t("action.close")}
            className="absolute right-3 top-3 text-3xl leading-none text-white"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={t("form.receipt")}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
