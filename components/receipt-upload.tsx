"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

interface Props {
  value: string | null;
  onChange: (path: string) => void;
}

export function ReceiptUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
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
    <div
      className="border rounded-md p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50"
      onClick={() => inputRef.current?.click()}
    >
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
        <img src={value} alt={t("form.receipt")} className="max-h-32 rounded object-contain" />
      ) : (
        <>
          <Camera className={`w-6 h-6 ${uploading ? "animate-pulse text-blue-500" : "text-gray-400"}`} />
          <span className="text-xs text-gray-500">
            {uploading ? t("state.uploading") : t("form.receipt_add")}
          </span>
        </>
      )}
    </div>
  );
}
