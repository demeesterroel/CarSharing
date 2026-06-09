"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useQueryParam(
  key: string,
  defaultValue: string = ""
): [string, (value: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (newValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, newValue);
      }
      const search = params.toString();
      const url = search ? `${pathname}?${search}` : pathname;
      router.replace(url, { scroll: false });
    },
    [searchParams, router, pathname, key, defaultValue]
  );

  return [value, setValue];
}
