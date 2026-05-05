"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPayoutRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/owner");
  }, [router]);
  return null;
}
