import { query } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { formatRows, fmtDate, fmtBool } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await query(
    `SELECT id, domain, company_name, status, pipeline_status,
            phone_1, state, city, industry, is_existing_customer,
            lead_score, first_seen_at, created_at
     FROM companies ORDER BY created_at DESC LIMIT 500`
  );

  const byPipeline = await query<{ pipeline_status: string; cnt: string }>(
    "SELECT pipeline_status, COUNT(*) as cnt FROM companies GROUP BY pipeline_status ORDER BY cnt DESC"
  );

  const needPhones = await query<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM companies WHERE domain IS NOT NULL AND (phone_1 IS NULL OR phone_1 = '')"
  );

  const needEnrichment = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM companies c
     WHERE c.domain IS NOT NULL AND c.status NOT IN ('disqualified','won','lost')
       AND c.is_existing_customer = false
       AND c.id NOT IN (SELECT company_id FROM enrichment_results)`
  );

  const rows = formatRows(companies, {
    is_existing_customer: fmtBool,
    first_seen_at: fmtDate,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Companies</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={companies.length} />
        {byPipeline.map((r) => (
          <StatCard key={r.pipeline_status} label={r.pipeline_status} value={r.cnt} />
        ))}
        <StatCard label="Need Phones" value={(needPhones[0] as { cnt: string })?.cnt ?? 0} />
        <StatCard label="Need Enrichment" value={(needEnrichment[0] as { cnt: string })?.cnt ?? 0} />
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: "id", label: "ID" },
          { key: "domain", label: "Domain" },
          { key: "company_name", label: "Name" },
          { key: "status", label: "Status" },
          { key: "pipeline_status", label: "Pipeline" },
          { key: "phone_1", label: "Phone" },
          { key: "state", label: "State" },
          { key: "industry", label: "Industry" },
          { key: "is_existing_customer", label: "Customer" },
          { key: "lead_score", label: "Score" },
          { key: "first_seen_at", label: "First Seen" },
        ]}
      />
    </div>
  );
}
