"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPayoutRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/owner");
  }, [router]);
  return null;
}
