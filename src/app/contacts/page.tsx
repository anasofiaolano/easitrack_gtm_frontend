import { query, queryOne } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { formatRows, fmtBool } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await query(
    `SELECT c.id, c.first_name, c.last_name, c.email, c.title,
            c.phone_direct, c.outreach_status, c.suppress_outreach, c.suppress_reason,
            c.do_not_contact, c.enrichment_source, c.enriched_at,
            co.company_name, co.domain as company_domain
     FROM contacts c
     JOIN companies co ON c.company_id = co.id
     ORDER BY c.created_at DESC LIMIT 500`
  );

  const total = await queryOne<{ cnt: string }>("SELECT COUNT(*) as cnt FROM contacts");
  const suppressed = await queryOne<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM contacts WHERE suppress_outreach = true"
  );
  const withEmail = await queryOne<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM contacts WHERE email IS NOT NULL AND email != ''"
  );

  const rows = formatRows(contacts, {
    suppress_outreach: fmtBool,
    do_not_contact: fmtBool,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contacts</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={total?.cnt ?? 0} />
        <StatCard label="With Email" value={withEmail?.cnt ?? 0} />
        <StatCard label="Suppressed" value={suppressed?.cnt ?? 0} />
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: "id", label: "ID" },
          { key: "first_name", label: "First" },
          { key: "last_name", label: "Last" },
          { key: "email", label: "Email" },
          { key: "title", label: "Title" },
          { key: "company_name", label: "Company" },
          { key: "company_domain", label: "Domain" },
          { key: "outreach_status", label: "Outreach" },
          { key: "suppress_outreach", label: "Suppressed" },
          { key: "suppress_reason", label: "Suppress Reason" },
          { key: "enrichment_source", label: "Source" },
        ]}
      />
    </div>
  );
}
