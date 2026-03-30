import { query } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { formatRows, fmtDate, fmtBool } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await query(
    `SELECT c.id, c.domain, c.company_name, c.status, c.pipeline_status,
            c.phone_1, c.state, c.city, c.industry, c.is_existing_customer,
            c.lead_score, c.first_seen_at, c.created_at,
            STRING_AGG(DISTINCT p.display_name, ', ' ORDER BY p.display_name) AS plays
     FROM companies c
     LEFT JOIN company_plays cp ON c.id = cp.company_id
     LEFT JOIN plays p ON cp.play_id = p.id
     GROUP BY c.id, c.domain, c.company_name, c.status, c.pipeline_status,
              c.phone_1, c.state, c.city, c.industry, c.is_existing_customer,
              c.lead_score, c.first_seen_at, c.created_at
     ORDER BY c.created_at DESC LIMIT 500`
  );

  const rows = formatRows(companies, {
    is_existing_customer: fmtBool,
    first_seen_at: fmtDate,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Companies</h1>

      <DataTable
        rows={rows}
        columns={[
          { key: "domain", label: "Domain" },
          { key: "company_name", label: "Name" },
          { key: "plays", label: "Plays" },
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
