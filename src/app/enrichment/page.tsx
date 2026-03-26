import { query, queryOne } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { formatRows, fmtDateTime, fmtUSD, fmtBool } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EnrichmentPage() {
  const runs = await query(
    `SELECT run_id, provider, enrichment_datetime, total_companies, total_found,
            total_not_found, credits_used, cost_usd, notes
     FROM enrichment_runs ORDER BY enrichment_datetime DESC LIMIT 50`
  );

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

  const runRows = formatRows(runs, {
    enrichment_datetime: fmtDateTime,
    cost_usd: fmtUSD,
  });

  const resultRows = formatRows(recentResults, {
    worth_enriching: fmtBool,
  });

  return (
    <div className="space-y-8">
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
