import { query, queryOne } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatRows, fmtDateTime, fmtUSD, fmtBool } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEP_ORDER = [
  "exa_search",
  "dedup",
  "phone_scrape",
  "apollo_search",
  "haiku_screen",
  "apollo_match",
] as const;

const STEP_LABELS: Record<string, string> = {
  exa_search: "Exa Search",
  dedup: "Dedup",
  phone_scrape: "Phone Scrape",
  apollo_search: "Apollo Search",
  haiku_screen: "Haiku Screen",
  apollo_match: "Apollo Match",
};

const STATUS_ICON: Record<string, string> = {
  completed: "\u2705",
  started: "\u23f3",
  failed: "\u274c",
  skipped: "\u23ed\ufe0f",
};

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (k === "reason" || k === "error") parts.push(String(v));
    else if (typeof v === "number") parts.push(`${k}: ${v}`);
    else if (typeof v === "boolean" && v) parts.push(k);
    else if (typeof v === "string" && v) parts.push(`${k}: ${v}`);
  }
  return parts.join(", ");
}

export default async function EnrichmentPage() {
  const runs = await query<{
    run_id: string;
    provider: string;
    enrichment_datetime: string;
    total_companies: number;
    total_found: number;
    total_not_found: number;
    credits_used: number;
    cost_usd: number;
    notes: string;
    status: string | null;
  }>(
    `SELECT run_id, provider, enrichment_datetime, total_companies, total_found,
            total_not_found, credits_used, cost_usd, notes, status
     FROM enrichment_runs ORDER BY enrichment_datetime DESC LIMIT 50`
  );

  // Find the most recent active run for live progress
  const activeRun = runs.find((r) => r.status === "running" || r.status === "pending");
  const progressRunId = activeRun?.run_id ?? runs[0]?.run_id;

  // Fetch step log for the progress run
  const stepLog = progressRunId
    ? await query<{
        company_id: number;
        company_name: string;
        domain: string;
        step: string;
        status: string;
        details: Record<string, unknown> | null;
        created_at: string;
      }>(
        `SELECT DISTINCT ON (psl.company_id, psl.step)
                psl.company_id, c.company_name, c.domain,
                psl.step, psl.status, psl.details, psl.created_at
         FROM pipeline_step_log psl
         JOIN companies c ON psl.company_id = c.id
         WHERE psl.run_id = $1
         ORDER BY psl.company_id, psl.step, psl.created_at DESC`,
        [progressRunId]
      )
    : [];

  // Pivot step log into per-company checklist
  const companyMap = new Map<
    number,
    { name: string; domain: string; steps: Map<string, { status: string; details: Record<string, unknown> | null }> }
  >();
  for (const row of stepLog) {
    if (!companyMap.has(row.company_id)) {
      companyMap.set(row.company_id, {
        name: row.company_name,
        domain: row.domain,
        steps: new Map(),
      });
    }
    companyMap.get(row.company_id)!.steps.set(row.step, {
      status: row.status,
      details: row.details,
    });
  }

  const resultsByProvider = await query<{ provider: string; cnt: string; emails: string }>(
    `SELECT provider, COUNT(*) as cnt,
            COUNT(person_email) as emails
     FROM enrichment_results GROUP BY provider`
  );

  const apiCallStats = await query<{ provider: string; endpoint: string; cnt: string; credits: string }>(
    `SELECT provider, endpoint, COUNT(*) as cnt, COALESCE(SUM(credits_charged), 0) as credits
     FROM api_calls GROUP BY provider, endpoint ORDER BY cnt DESC`
  );

  const totalCredits = await queryOne<{ total: string }>(
    "SELECT COALESCE(SUM(credits_charged), 0) as total FROM api_calls"
  );

  const totalCost = await queryOne<{ total: string }>(
    "SELECT COALESCE(SUM(cost_usd), 0)::text as total FROM enrichment_runs"
  );

  const recentResults = await query(
    `SELECT er.person_name, er.person_title, er.person_email, er.email_status,
            er.provider, er.worth_enriching,
            c.company_name, c.domain
     FROM enrichment_results er
     JOIN companies c ON er.company_id = c.id
     ORDER BY er.id DESC LIMIT 200`
  );

  const runRows = formatRows(runs as Record<string, unknown>[], {
    enrichment_datetime: fmtDateTime,
    cost_usd: fmtUSD,
  });

  const resultRows = formatRows(recentResults, {
    worth_enriching: fmtBool,
  });

  const isActive = !!activeRun;

  return (
    <div className="space-y-8">
      <AutoRefresh active={isActive} intervalMs={5000} />

      <h1 className="text-2xl font-bold">Enrichment</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Enrichment Runs" value={runs.length} />
        <StatCard label="Total Credits" value={totalCredits?.total ?? 0} />
        <StatCard label="Total Cost" value={`$${Number(totalCost?.total ?? 0).toFixed(2)}`} />
        {resultsByProvider.map((r) => (
          <StatCard
            key={r.provider}
            label={`${r.provider} results`}
            value={r.cnt}
            sub={`${r.emails} with email`}
          />
        ))}
      </div>

      {/* Live Pipeline Progress */}
      {progressRunId && companyMap.size > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Pipeline Progress
              {isActive && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </h2>
            <span className="text-xs text-zinc-400 font-mono">{progressRunId}</span>
          </div>

          <div className="space-y-3">
            {Array.from(companyMap.entries()).map(([companyId, { name, domain, steps }]) => (
              <div key={companyId} className="border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0">
                <div className="font-medium text-sm">
                  {name}{" "}
                  <span className="text-zinc-400 text-xs">({domain})</span>
                </div>
                <div className="mt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1">
                  {STEP_ORDER.map((step) => {
                    const s = steps.get(step);
                    const icon = s ? STATUS_ICON[s.status] ?? "" : "\u2B1C";
                    const detail = s ? formatDetails(s.details) : "";
                    return (
                      <div
                        key={step}
                        className="text-xs flex items-center gap-1"
                        title={detail}
                      >
                        <span>{icon}</span>
                        <span className={s ? "" : "text-zinc-400"}>{STEP_LABELS[step]}</span>
                        {detail && (
                          <span className="text-zinc-400 truncate max-w-[100px]">
                            {detail}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="font-semibold mb-3">API Calls</h2>
        {apiCallStats.length === 0 && <p className="text-sm text-zinc-400">No API calls yet</p>}
        <div className="space-y-2">
          {apiCallStats.map((r) => (
            <div key={`${r.provider}-${r.endpoint}`} className="flex justify-between items-center text-sm">
              <span>
                <span className="font-medium">{r.provider}</span>
                <span className="text-zinc-400 ml-1">/ {r.endpoint}</span>
              </span>
              <span>
                {r.cnt} calls, {r.credits} credits
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Enrichment Runs</h2>
        <DataTable
          rows={runRows}
          columns={[
            { key: "run_id", label: "Run ID" },
            { key: "provider", label: "Provider" },
            { key: "status", label: "Status" },
            { key: "enrichment_datetime", label: "Date" },
            { key: "total_companies", label: "Companies" },
            { key: "total_found", label: "Found" },
            { key: "total_not_found", label: "Not Found" },
            { key: "credits_used", label: "Credits" },
            { key: "cost_usd", label: "Cost" },
            { key: "notes", label: "Notes" },
          ]}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Enrichment Results</h2>
        <DataTable
          rows={resultRows}
          columns={[
            { key: "company_name", label: "Company" },
            { key: "domain", label: "Domain" },
            { key: "provider", label: "Provider" },
            { key: "person_name", label: "Name" },
            { key: "person_title", label: "Title" },
            { key: "person_email", label: "Email" },
            { key: "email_status", label: "Email Status" },
            { key: "worth_enriching", label: "Worth It" },
          ]}
        />
      </div>
    </div>
  );
}
