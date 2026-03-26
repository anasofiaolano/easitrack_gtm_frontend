const STATUS_COLORS: Record<string, string> = {
  // Pipeline statuses
  discovered: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  deduped: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  phone_scraped: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  enriched: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  phone_failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  enrich_failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  // Company statuses
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  won: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  disqualified: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  // Outreach
  sequenced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  opened: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  replied: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  bounced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  opted_out: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  do_not_contact: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function StatusBadge({ status }: { status: string }) {
  const colors =
    STATUS_COLORS[status] ??
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}
