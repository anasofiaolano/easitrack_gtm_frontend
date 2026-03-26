import { query, queryOne } from "@/lib/db";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatRows, fmtDateTime, fmtBool } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const outreach = await query(
    `SELECT o.id, o.channel, o.outreach_type, o.subject, o.outcome,
            o.sent_at, o.sent_by,
            c.first_name, c.last_name, c.email,
            co.company_name
     FROM outreach o
     JOIN contacts c ON o.contact_id = c.id
     JOIN companies co ON o.company_id = co.id
     ORDER BY o.sent_at DESC LIMIT 500`
  );

  const total = await queryOne<{ cnt: string }>("SELECT COUNT(*) as cnt FROM outreach");
  const byOutcome = await query<{ outcome: string; cnt: string }>(
    "SELECT outcome, COUNT(*) as cnt FROM outreach GROUP BY outcome ORDER BY cnt DESC"
  );
  const byType = await query<{ outreach_type: string; cnt: string }>(
    "SELECT outreach_type, COUNT(*) as cnt FROM outreach GROUP BY outreach_type ORDER BY cnt DESC"
  );

  const sequenced = await query(
    `SELECT c.id, c.first_name, c.last_name, c.email, c.outreach_status,
            c.suppress_outreach, c.suppress_reason,
            co.company_name,
            (SELECT COUNT(*) FROM outreach WHERE contact_id = c.id) as emails_sent,
            (SELECT MAX(sent_at) FROM outreach WHERE contact_id = c.id) as last_email_at
     FROM contacts c
     JOIN companies co ON c.company_id = co.id
     WHERE c.outreach_status IN ('sequenced', 'contacted', 'completed')
     ORDER BY c.updated_at DESC LIMIT 200`
  );

  const outreachRows = formatRows(outreach, { sent_at: fmtDateTime });
  const sequencedRows = formatRows(sequenced, {
    suppress_outreach: fmtBool,
    last_email_at: fmtDateTime,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Outreach</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Sent" value={total?.cnt ?? 0} />
        {byOutcome.map((r) => (
          <StatCard key={r.outcome} label={r.outcome} value={r.cnt} />
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="font-semibold mb-3">By Type</h2>
        <div className="flex gap-4 flex-wrap">
          {byType.map((r) => (
            <div key={r.outreach_type} className="flex items-center gap-2">
              <StatusBadge status={r.outreach_type} />
              <span className="text-sm font-medium">{r.cnt}</span>
            </div>
          ))}
          {byType.length === 0 && <p className="text-sm text-zinc-400">No outreach yet</p>}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Sequence Status</h2>
        <DataTable
          rows={sequencedRows}
          columns={[
            { key: "id", label: "ID" },
            { key: "first_name", label: "First" },
            { key: "last_name", label: "Last" },
            { key: "email", label: "Email" },
            { key: "company_name", label: "Company" },
            { key: "outreach_status", label: "Status" },
            { key: "emails_sent", label: "Emails Sent" },
            { key: "last_email_at", label: "Last Email" },
            { key: "suppress_outreach", label: "Suppressed" },
            { key: "suppress_reason", label: "Reason" },
          ]}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">All Outreach</h2>
        <DataTable
          rows={outreachRows}
          columns={[
            { key: "id", label: "ID" },
            { key: "first_name", label: "Contact" },
            { key: "email", label: "Email" },
            { key: "company_name", label: "Company" },
            { key: "channel", label: "Channel" },
            { key: "outreach_type", label: "Type" },
            { key: "subject", label: "Subject" },
            { key: "outcome", label: "Outcome" },
            { key: "sent_at", label: "Sent" },
            { key: "sent_by", label: "Sent By" },
          ]}
        />
      </div>
    </div>
  );
}
