import { query, queryOne } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { formatRows, fmtDateTime, fmtJSON } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await query(
    `SELECT e.id, e.event_type, e.old_value, e.new_value, e.details,
            e.actor, e.created_at,
            co.company_name, co.domain,
            c.first_name as contact_first, c.last_name as contact_last, c.email as contact_email
     FROM event_log e
     JOIN companies co ON e.company_id = co.id
     LEFT JOIN contacts c ON e.contact_id = c.id
     ORDER BY e.created_at DESC LIMIT 500`
  );

  const total = await queryOne<{ cnt: string }>("SELECT COUNT(*) as cnt FROM event_log");
  const byType = await query<{ event_type: string; cnt: string }>(
    "SELECT event_type, COUNT(*) as cnt FROM event_log GROUP BY event_type ORDER BY cnt DESC"
  );

  const rows = formatRows(events, {
    created_at: fmtDateTime,
    details: fmtJSON,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Event Log</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Events" value={total?.cnt ?? 0} />
        {byType.slice(0, 5).map((r) => (
          <StatCard key={r.event_type} label={r.event_type} value={r.cnt} />
        ))}
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: "id", label: "ID" },
          { key: "created_at", label: "Time" },
          { key: "event_type", label: "Event" },
          { key: "company_name", label: "Company" },
          { key: "contact_first", label: "Contact" },
          { key: "old_value", label: "Old" },
          { key: "new_value", label: "New" },
          { key: "actor", label: "Actor" },
          { key: "details", label: "Details" },
        ]}
      />
    </div>
  );
}
