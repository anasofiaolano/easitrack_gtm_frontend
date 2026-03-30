import { query } from "@/lib/db";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { formatRows, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  // Sequences with live step counts and enrollment stats across all statuses.
  // step_count is derived live (no denormalized column — would drift without a trigger).
  // Enrollment counts cover all statuses so reply rate denominator is correct.
  const sequences = await query<{
    id: number;
    name: string;
    description: string | null;
    play_name: string | null;
    step_count: string;
    is_active: boolean;
    active_enrollments: string;
    completed_enrollments: string;
    replied_enrollments: string;
    total_enrollments: string;
    created_at: string;
  }>(
    `SELECT s.id, s.name, s.description, p.display_name AS play_name,
            s.is_active, s.created_at,
            COUNT(DISTINCT st.id)                                        AS step_count,
            COUNT(e.id) FILTER (WHERE e.status = 'active')               AS active_enrollments,
            COUNT(e.id) FILTER (WHERE e.status = 'completed')            AS completed_enrollments,
            COUNT(e.id) FILTER (WHERE e.status = 'replied')              AS replied_enrollments,
            COUNT(e.id)                                                  AS total_enrollments
     FROM sequences s
     LEFT JOIN plays p ON s.play_id = p.id
     LEFT JOIN sequence_steps st ON s.id = st.sequence_id
     LEFT JOIN sequence_enrollments e ON s.id = e.sequence_id
     GROUP BY s.id, s.name, s.description, p.display_name, s.is_active, s.created_at
     ORDER BY s.created_at DESC`
  );

  // Enrollment detail — paginate at 500. Stat card totals come from a
  // separate aggregate query so they're never capped by the row limit.
  const [enrollments, enrollmentTotals, sendStats] = await Promise.all([
    query<{
      enrollment_id: number;
      sequence_name: string;
      company_name: string;
      domain: string | null;
      contact_name: string | null;
      email: string | null;
      play_name: string | null;
      current_step: number;
      step_count: string;
      status: string;
      enrolled_at: string;
      completed_at: string | null;
    }>(
      `SELECT e.id AS enrollment_id,
              s.name AS sequence_name,
              co.company_name, co.domain,
              ct.full_name AS contact_name, ct.email,
              p.display_name AS play_name,
              e.current_step,
              COUNT(st.id) AS step_count,
              e.status, e.enrolled_at, e.completed_at
       FROM sequence_enrollments e
       JOIN sequences s ON e.sequence_id = s.id
       JOIN companies co ON e.company_id = co.id
       LEFT JOIN contacts ct ON e.contact_id = ct.id
       LEFT JOIN plays p ON e.play_id = p.id
       LEFT JOIN sequence_steps st ON s.id = st.sequence_id
       GROUP BY e.id, s.name, co.company_name, co.domain,
                ct.full_name, ct.email, p.display_name, e.current_step, e.status,
                e.enrolled_at, e.completed_at
       ORDER BY e.enrolled_at DESC
       LIMIT 500`
    ),
    query<{ total: string; active: string; replied: string }>(
      `SELECT COUNT(*)                                      AS total,
              COUNT(*) FILTER (WHERE status = 'active')    AS active,
              COUNT(*) FILTER (WHERE status = 'replied')   AS replied
       FROM sequence_enrollments`
    ),
    query<{ status: string; cnt: string }>(
      `SELECT status, COUNT(*) AS cnt FROM sequence_sends GROUP BY status ORDER BY cnt DESC`
    ),
  ]);

  const totals = enrollmentTotals[0] ?? { total: "0", active: "0", replied: "0" };
  const totalSent = sendStats.find((s) => s.status === "sent")?.cnt ?? "0";

  const enrollmentRows = formatRows(
    enrollments.map((e) => ({
      ...e,
      progress: `${e.current_step} / ${e.step_count}`,
    })),
    { enrolled_at: fmtDate, completed_at: fmtDate }
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sequences</h1>
        <div className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-3 py-1.5">
          Sending requires Inngest + Resend — not yet wired up
        </div>
      </div>

      {/* Stats — sourced from aggregate query, not capped by row limit */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sequences" value={sequences.length} />
        <StatCard label="Enrolled" value={totals.total} sub={`${totals.active} active`} />
        <StatCard label="Replied" value={totals.replied} />
        <StatCard label="Emails Sent" value={totalSent} />
      </div>

      {/* Sequences list */}
      <section>
        <h2 className="font-semibold mb-3 text-lg">All Sequences</h2>
        {sequences.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
            <p className="text-zinc-400 text-sm mb-1">No sequences yet.</p>
            <p className="text-zinc-300 dark:text-zinc-600 text-xs">
              Create a sequence in the DB, then enroll companies from the Pipeline page.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sequences.map((seq) => {
              // Denominator = all enrollments for this sequence (not just active/completed/replied)
              // so reply rate isn't inflated by excluding bounced/unsubscribed.
              const total = Number(seq.total_enrollments);
              const replyRate =
                total > 0 && Number(seq.replied_enrollments) > 0
                  ? Math.round((Number(seq.replied_enrollments) / total) * 100)
                  : 0;

              return (
                <div
                  key={seq.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-6"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{seq.name}</span>
                      {!seq.is_active && (
                        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                          archived
                        </span>
                      )}
                    </div>
                    {seq.description && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">{seq.description}</p>
                    )}
                    {seq.play_name && (
                      <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-0.5">
                        Play: {seq.play_name}
                      </p>
                    )}
                  </div>

                  <div className="text-center shrink-0">
                    <p className="text-xl font-semibold">{seq.step_count}</p>
                    <p className="text-xs text-zinc-400">steps</p>
                  </div>

                  <div className="flex gap-6 shrink-0 text-center">
                    <div>
                      <p className="text-lg font-semibold">{seq.active_enrollments}</p>
                      <p className="text-xs text-zinc-400">active</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{seq.completed_enrollments}</p>
                      <p className="text-xs text-zinc-400">completed</p>
                    </div>
                    <div>
                      <p className={`text-lg font-semibold ${Number(seq.replied_enrollments) > 0 ? "text-green-600" : ""}`}>
                        {seq.replied_enrollments}
                      </p>
                      <p className="text-xs text-zinc-400">replied</p>
                    </div>
                    {replyRate > 0 && (
                      <div>
                        <p className="text-lg font-semibold text-green-600">{replyRate}%</p>
                        <p className="text-xs text-zinc-400">reply rate</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Enrollments table */}
      {enrollments.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3 text-lg">Enrollments</h2>
          <DataTable
            rows={enrollmentRows}
            columns={[
              { key: "sequence_name", label: "Sequence" },
              { key: "company_name",  label: "Company" },
              { key: "domain",        label: "Domain" },
              { key: "contact_name",  label: "Contact" },
              { key: "email",         label: "Email" },
              { key: "play_name",     label: "Play" },
              { key: "progress",      label: "Progress" },
              { key: "status",        label: "Status" },
              { key: "enrolled_at",   label: "Enrolled" },
              { key: "completed_at",  label: "Completed" },
            ]}
          />
        </section>
      )}

      {/* Send breakdown */}
      {sendStats.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3 text-lg">Send Breakdown</h2>
          <div className="flex flex-wrap gap-4">
            {sendStats.map((s) => (
              <StatCard key={s.status} label={s.status} value={s.cnt} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
