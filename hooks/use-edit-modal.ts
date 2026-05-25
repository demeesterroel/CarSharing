"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function useEditModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const actionParam = searchParams.get("action");
  const editIdParam = searchParams.get("edit");

  const adding = actionParam === "add";
  const editingId = editIdParam ? Number(editIdParam) : null;

  const [modalClosed, setModalClosed] = useState(false);
  useEffect(() => { setModalClosed(false); }, [editingId]);

  const openAdd = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("action", "add");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const openEdit = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", String(id));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeModal = () => {
    setModalClosed(true);
    window.history.replaceState(null, "", pathname);
  };

  return { adding, editingId, modalClosed, openAdd, openEdit, closeModal };
}
