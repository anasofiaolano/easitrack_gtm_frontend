"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Auto-refresh component — calls router.refresh() every `intervalMs`
 * when `active` is true. Placed inside server component pages to
 * trigger re-fetching of server data without a full page reload.
 */
export function AutoRefresh({
  active,
  intervalMs = 5000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
