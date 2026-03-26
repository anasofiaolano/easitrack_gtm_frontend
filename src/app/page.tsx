import { query, queryOne } from "@/lib/db";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [
    companyCount,
    contactCount,
    outreachCount,
    companiesWithPhones,
    companiesByStatus,
    companiesByPipeline,
    contactsByOutreach,
    outreachByOutcome,
    plays,
    recentEvents,
    suppressed,
  ] = await Promise.all([
    queryOne<{ cnt: string }>("SELECT COUNT(*) as cnt FROM companies"),
    queryOne<{ cnt: string }>("SELECT COUNT(*) as cnt FROM contacts"),
    queryOne<{ cnt: string }>("SELECT COUNT(*) as cnt FROM outreach"),
    queryOne<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM companies WHERE phone_1 IS NOT NULL AND phone_1 != ''"
    ),
    query<{ status: string; cnt: string }>(
      "SELECT status, COUNT(*) as cnt FROM companies GROUP BY status ORDER BY cnt DESC"
    ),
    query<{ pipeline_status: string; cnt: string }>(
      "SELECT pipeline_status, COUNT(*) as cnt FROM companies GROUP BY pipeline_status ORDER BY cnt DESC"
    ),
    query<{ outreach_status: string; cnt: string }>(
      "SELECT outreach_status, COUNT(*) as cnt FROM contacts GROUP BY outreach_status ORDER BY cnt DESC"
    ),
    query<{ outcome: string; cnt: string }>(
      "SELECT outcome, COUNT(*) as cnt FROM outreach GROUP BY outcome ORDER BY cnt DESC"
    ),
    query<{ display_name: string; cnt: string }>(
      `SELECT p.display_name, COUNT(cp.company_id) as cnt
       FROM plays p LEFT JOIN company_plays cp ON p.id = cp.play_id
       GROUP BY p.id, p.display_name ORDER BY cnt DESC`
    ),
    query<{ event_type: string; created_at: string; actor: string; new_value: string }>(
      "SELECT event_type, created_at, actor, new_value FROM event_log ORDER BY created_at DESC LIMIT 20"
    ),
    queryOne<{ cnt: string }>(
      "SELECT COUNT(*) as cnt FROM contacts WHERE suppress_outreach = true"
    ),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Pipeline Overview</h1>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Companies" value={companyCount?.cnt ?? 0} />
        <StatCard
          label="With Phones"
          value={companiesWithPhones?.cnt ?? 0}
          sub={`of ${companyCount?.cnt ?? 0} companies`}
        />
        <StatCard label="Contacts" value={contactCount?.cnt ?? 0} />
        <StatCard label="Outreach Sent" value={outreachCount?.cnt ?? 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Companies by Status */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Companies by Status</h2>
          {companiesByStatus.length === 0 && <p className="text-sm text-zinc-400">No data</p>}
          <div className="space-y-2">
            {companiesByStatus.map((r) => (
              <div key={r.status} className="flex justify-between items-center">
                <StatusBadge status={r.status} />
                <span className="text-sm font-medium">{r.cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Status */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Pipeline Status</h2>
          {companiesByPipeline.length === 0 && <p className="text-sm text-zinc-400">No data</p>}
          <div className="space-y-2">
            {companiesByPipeline.map((r) => (
              <div key={r.pipeline_status} className="flex justify-between items-center">
                <StatusBadge status={r.pipeline_status} />
                <span className="text-sm font-medium">{r.cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Outreach Status */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Contact Outreach Status</h2>
          {contactsByOutreach.length === 0 && <p className="text-sm text-zinc-400">No data</p>}
          <div className="space-y-2">
            {contactsByOutreach.map((r) => (
              <div key={r.outreach_status} className="flex justify-between items-center">
                <StatusBadge status={r.outreach_status} />
                <span className="text-sm font-medium">{r.cnt}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">Suppressed</span>
              <span className="text-sm font-medium text-red-600">{suppressed?.cnt ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Outreach by Outcome */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Outreach Outcomes</h2>
          {outreachByOutcome.length === 0 && <p className="text-sm text-zinc-400">No outreach yet</p>}
          <div className="space-y-2">
            {outreachByOutcome.map((r) => (
              <div key={r.outcome} className="flex justify-between items-center">
                <StatusBadge status={r.outcome} />
                <span className="text-sm font-medium">{r.cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plays */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Plays</h2>
          {plays.length === 0 && <p className="text-sm text-zinc-400">No plays yet</p>}
          <div className="space-y-2">
            {plays.map((r) => (
              <div key={r.display_name} className="flex justify-between items-center">
                <span className="text-sm">{r.display_name}</span>
                <span className="text-sm font-medium">{r.cnt} companies</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="font-semibold mb-3">Recent Events</h2>
        {recentEvents.length === 0 && <p className="text-sm text-zinc-400">No events yet</p>}
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {recentEvents.map((e, i) => (
            <div key={i} className="flex gap-3 text-sm py-1 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
              <span className="text-zinc-400 text-xs w-36 shrink-0">
                {new Date(e.created_at).toLocaleString()}
              </span>
              <StatusBadge status={e.event_type} />
              <span className="text-zinc-600 dark:text-zinc-400 truncate">
                {e.new_value && `\u2192 ${e.new_value}`} {e.actor && `(${e.actor})`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
