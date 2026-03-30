"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type StepState = "idle" | "running" | "done" | "error";

interface RunResult {
  runId?: string;
  error?: string;
  state?: string;
}

interface StepLog {
  company_name: string;
  domain: string;
  step: string;
  status: string;
  details: Record<string, unknown> | null;
}

interface StepSummary {
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}

interface SummaryLine {
  label: string;
  value: number;
  color?: "green" | "yellow" | "red" | "default";
}

interface EnrichmentResult {
  company_name: string;
  domain: string;
  person_name: string | null;
  person_title: string | null;
  person_email: string | null;
  worth_enriching: boolean | null;
}

interface ExaCompany {
  company_name: string;
  domain: string;
  pipeline_status: string;
  phone_1: string | null;
}

interface Play {
  id: number;
  name: string;
  created_at: string;
  company_count: number;
}

export default function PipelinePage() {
  const [query, setQuery] = useState("");
  const [play, setPlay] = useState("");
  const [numResults, setNumResults] = useState(25);
  const [plays, setPlays] = useState<Play[]>([]);

  const [exaState, setExaState] = useState<StepState>("idle");
  const [apolloSearchState, setApolloSearchState] = useState<StepState>("idle");
  const [haikuState, setHaikuState] = useState<StepState>("idle");
  const [exaRunId, setExaRunId] = useState<string | null>(null);
  const [apolloSearchRunId, setApolloSearchRunId] = useState<string | null>(null);
  const [haikuRunId, setHaikuRunId] = useState<string | null>(null);

  const [exaError, setExaError] = useState<string | null>(null);
  const [apolloSearchError, setApolloSearchError] = useState<string | null>(null);
  const [apolloSearchForce, setApolloSearchForce] = useState(false);
  const [haikuError, setHaikuError] = useState<string | null>(null);

  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [enrichResults, setEnrichResults] = useState<EnrichmentResult[]>([]);
  const [exaCompanies, setExaCompanies] = useState<ExaCompany[]>([]);

  const isAnyRunning = exaState === "running" || apolloSearchState === "running" || haikuState === "running";

  // Load plays list
  useEffect(() => {
    fetch("/api/pipeline/plays")
      .then((r) => r.ok ? r.json() : [])
      .then(setPlays)
      .catch(() => {});
  }, []);

  // Sync play name to query
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setPlay(val);
  };

  const selectPlay = (name: string) => {
    setQuery(name);
    setPlay(name);
    // Reset button states when switching plays
    setExaState("idle");
    setApolloSearchState("idle");
    setHaikuState("idle");
    setExaRunId(null);
    setApolloSearchRunId(null);
    setHaikuRunId(null);
    setExaError(null);
    setApolloSearchError(null);
    setHaikuError(null);
  };

  const fetchResults = useCallback(async () => {
    if (!play) return;
    try {
      const [logsRes, enrichRes, companiesRes] = await Promise.all([
        fetch(`/api/pipeline/results?type=logs&play=${encodeURIComponent(play)}`),
        fetch(`/api/pipeline/results?type=enrichment&play=${encodeURIComponent(play)}`),
        fetch(`/api/pipeline/results?type=companies&play=${encodeURIComponent(play)}`),
      ]);
      if (logsRes.ok) setStepLogs(await logsRes.json());
      if (enrichRes.ok) setEnrichResults(await enrichRes.json());
      if (companiesRes.ok) setExaCompanies(await companiesRes.json());
    } catch {
      // ignore fetch errors
    }
  }, [play]);

  // Fetch once on play change, then rely on realtime for updates
  useEffect(() => {
    if (!play) return;
    fetchResults();
  }, [play, fetchResults]);

  // Subscribe to Supabase Realtime — refetch when any monitored table changes
  useEffect(() => {
    if (!play) return;

    const channel = supabase
      .channel(`pipeline-${play}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => fetchResults())
      .on("postgres_changes", { event: "*", schema: "public", table: "enrichment_results" }, () => fetchResults())
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_step_log" }, () => fetchResults())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [play, fetchResults]);

  // Refresh plays list after triggering a flow (new play may have been created)
  const refreshPlays = () => {
    fetch("/api/pipeline/plays")
      .then((r) => r.ok ? r.json() : [])
      .then(setPlays)
      .catch(() => {});
  };

  async function triggerFlow(
    endpoint: string,
    params: Record<string, unknown>,
    setRunState: (s: StepState) => void,
    setRunId: (id: string | null) => void,
    setError: (e: string | null) => void,
  ) {
    setRunState("running");
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data: RunResult = await res.json();
      if (!res.ok || data.error) {
        setRunState("error");
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setRunId(data.runId || null);
        setRunState("done");
        refreshPlays();
      }
    } catch (err) {
      setRunState("error");
      setError(String(err));
    }
  }

  const runExa = () =>
    triggerFlow("/api/pipeline/exa", { query, play, numResults }, setExaState, setExaRunId, setExaError);
  const runApolloSearch = () =>
    triggerFlow("/api/pipeline/people-search", { play, force: apolloSearchForce }, setApolloSearchState, setApolloSearchRunId, setApolloSearchError);
  const runHaiku = () =>
    triggerFlow("/api/pipeline/haiku", { play }, setHaikuState, setHaikuRunId, setHaikuError);

  const isAnyTriggered = exaState === "done" || apolloSearchState === "done" || haikuState === "done";

  // Logs are returned DESC by created_at — first entry per domain = most recent run.
  function latestByDomain(stepName: string): Map<string, StepLog> {
    const map = new Map<string, StepLog>();
    for (const l of stepLogs) {
      if (l.step !== stepName) continue;
      const key = l.domain || l.company_name;
      if (!map.has(key)) map.set(key, l);
    }
    return map;
  }

  function stepSummary(stepName: string): StepSummary | null {
    const byDomain = latestByDomain(stepName);
    if (byDomain.size === 0) return null;
    const entries = Array.from(byDomain.values());
    return {
      completed: entries.filter((l) => l.status === "completed").length,
      failed: entries.filter((l) => l.status === "failed").length,
      skipped: entries.filter((l) => l.status !== "completed" && l.status !== "failed").length,
      total: byDomain.size,
    };
  }

  // Exa summary — uses dedup step for new/duplicate counts, domain_check for no-domain.
  const exaSummaryLines: SummaryLine[] | null = (() => {
    const dedupEntries = latestByDomain("dedup");
    if (dedupEntries.size === 0) return null;

    const domainCheckEntries = latestByDomain("domain_check");

    let newCount = 0, dupCount = 0, noDomainCount = 0;
    for (const l of dedupEntries.values()) {
      const action = (l.details as Record<string, unknown>)?.action;
      if (action === "new_company") newCount++;
      else if (action === "matched_existing") dupCount++;
    }
    for (const l of domainCheckEntries.values()) {
      if (l.status === "failed") noDomainCount++;
    }

    const found = dedupEntries.size;
    const allGood = dupCount === 0 && noDomainCount === 0;
    return [
      { label: "found",     value: found,       color: "default" },
      { label: "new",       value: newCount,     color: allGood ? "green" : "default" },
      ...(dupCount > 0     ? [{ label: "duplicate", value: dupCount,     color: "yellow" as const }] : []),
      ...(noDomainCount > 0 ? [{ label: "no domain", value: noDomainCount, color: "yellow" as const }] : []),
    ];
  })();

  const peopleSummary = stepSummary("apollo_search");
  const haikuSummary = stepSummary("haiku_screen");

  return (
    <div className="flex gap-6 -mx-6 -my-6 min-h-[calc(100vh-4rem)]">
      {/* Sidebar — past plays */}
      <aside className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide">Plays</h2>
        </div>
        <div className="p-2">
          <button
            onClick={() => { setQuery(""); setPlay(""); setExaCompanies([]); setEnrichResults([]); setStepLogs([]); }}
            className="w-full text-left px-3 py-2 rounded text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 mb-1"
          >
            + New Play
          </button>
          {plays.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPlay(p.name)}
              className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors ${
                play === p.name
                  ? "bg-zinc-100 dark:bg-zinc-800 font-medium"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <span className="block truncate">{p.name}</span>
              <span className="text-xs text-zinc-400">{p.company_count} companies</span>
            </button>
          ))}
          {plays.length === 0 && (
            <p className="px-3 py-4 text-sm text-zinc-400">No plays yet. Run Exa Search to create one.</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 py-6 pr-4 space-y-8 overflow-y-auto">
        <h1 className="text-2xl font-bold">Pipeline</h1>

        {/* Inputs */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search Query / Play Name</label>
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="small trucking company in Ohio"
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Num Results</label>
              <input
                type="number"
                value={numResults}
                onChange={(e) => setNumResults(Number(e.target.value))}
                min={1}
                max={100}
                className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchResults}
                disabled={!play}
                className="px-4 py-2 rounded text-sm font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Refresh Results
              </button>
            </div>
          </div>
        </div>

        {/* 4 Flow Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FlowCard
            title="1. Exa Search"
            description="Search Exa, dedupe, scrape phones"
            state={exaState}
            runId={exaRunId}
            error={exaError}
            disabled={!query || !play || isAnyRunning}
            onRun={runExa}
            summaryLines={exaSummaryLines}
          />
          <FlowCard
            title="2. People Search (Hunter)"
            description="Find people at each company via Hunter.io"
            state={apolloSearchState}
            runId={apolloSearchRunId}
            error={apolloSearchError}
            disabled={!play || isAnyRunning}
            onRun={runApolloSearch}
            forceOption={{ value: apolloSearchForce, onChange: setApolloSearchForce }}
            summary={peopleSummary}
          />
          <FlowCard
            title="3. Haiku Screen"
            description="AI screening of each person"
            state={haikuState}
            runId={haikuRunId}
            error={haikuError}
            disabled={!play || isAnyRunning}
            onRun={runHaiku}
            summary={haikuSummary}
          />
        </div>

        {/* Status indicator */}
        {(isAnyTriggered || isAnyRunning) && (
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Flow running on server — results update in real time
          </p>
        )}

        {/* Merged companies + people table */}
        {exaCompanies.length > 0 && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h2 className="font-semibold mb-3">Companies ({exaCompanies.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-2 pr-4 font-medium">Company</th>
                    <th className="pb-2 pr-4 font-medium">Domain</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Phone</th>
                    <th className="pb-2 pr-4 font-medium">Person</th>
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 font-medium">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {exaCompanies.map((c, ci) => {
                    const people = enrichResults.filter(
                      (r) => r.domain === c.domain && r.person_name
                    );
                    const rowBg = ci % 2 === 0 ? "" : "bg-zinc-50 dark:bg-zinc-800/30";
                    const statusBadge = (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                        c.pipeline_status === "enriched" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                        c.pipeline_status === "phone_scraped" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {c.pipeline_status}
                      </span>
                    );

                    if (people.length === 0) {
                      return (
                        <tr key={c.domain} className={`border-b border-zinc-100 dark:border-zinc-800 ${rowBg}`}>
                          <td className="py-1.5 pr-4 font-medium">{c.company_name}</td>
                          <td className="py-1.5 pr-4 text-zinc-400">{c.domain}</td>
                          <td className="py-1.5 pr-4">{statusBadge}</td>
                          <td className="py-1.5 pr-4 text-zinc-400">{c.phone_1 || "-"}</td>
                          <td className="py-1.5 pr-4 text-zinc-300 dark:text-zinc-600">-</td>
                          <td className="py-1.5 pr-4 text-zinc-300 dark:text-zinc-600">-</td>
                          <td className="py-1.5 pr-4 text-zinc-300 dark:text-zinc-600">-</td>
                          <td className="py-1.5 text-zinc-300 dark:text-zinc-600">-</td>
                        </tr>
                      );
                    }

                    return people.map((person, pi) => (
                      <tr key={`${c.domain}-${pi}`} className={`border-b border-zinc-100 dark:border-zinc-800 ${rowBg}`}>
                        {/* Company columns — only on first person row */}
                        {pi === 0 ? (
                          <>
                            <td className="py-1.5 pr-4 font-medium align-top">{c.company_name}</td>
                            <td className="py-1.5 pr-4 text-zinc-400 align-top">{c.domain}</td>
                            <td className="py-1.5 pr-4 align-top">{statusBadge}</td>
                            <td className="py-1.5 pr-4 text-zinc-400 align-top">{c.phone_1 || "-"}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-1.5 pr-4" />
                            <td className="py-1.5 pr-4" />
                            <td className="py-1.5 pr-4" />
                            <td className="py-1.5 pr-4" />
                          </>
                        )}
                        {/* Person columns */}
                        <td className="py-1.5 pr-4">{person.person_name}</td>
                        <td className="py-1.5 pr-4 text-zinc-500">{person.person_title || "-"}</td>
                        <td className="py-1.5 pr-4 text-blue-600 dark:text-blue-400">{person.person_email || "-"}</td>
                        <td className="py-1.5">
                          {person.worth_enriching === true
                            ? <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
                            : person.worth_enriching === false
                            ? <span className="text-zinc-400">No</span>
                            : <span className="text-zinc-300 dark:text-zinc-600">-</span>}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!play && (
          <div className="text-center py-16 text-zinc-400">
            <p className="text-lg">Select a play from the sidebar or create a new one</p>
            <p className="text-sm mt-1">Enter a search query above to start</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FlowCard({
  title,
  description,
  state,
  runId,
  error,
  disabled,
  onRun,
  forceOption,
  summary,
  summaryLines,
}: {
  title: string;
  description: string;
  state: StepState;
  runId: string | null;
  error: string | null;
  disabled: boolean;
  onRun: () => void;
  forceOption?: { value: boolean; onChange: (v: boolean) => void };
  summary?: StepSummary | null;
  summaryLines?: SummaryLine[] | null;
}) {
  const allDone = summary && summary.failed === 0 && summary.skipped === 0 && summary.completed === summary.total;
  const hasFailed = summary && summary.failed > 0;
  const hasSkipped = summary && summary.skipped > 0;

  const colorClass = (color: SummaryLine["color"]) => {
    if (color === "green")  return "text-green-700 dark:text-green-400";
    if (color === "yellow") return "text-yellow-600 dark:text-yellow-400";
    if (color === "red")    return "text-red-500";
    return "text-zinc-500 dark:text-zinc-400";
  };

  const hasProblemLines = summaryLines?.some((l) => l.color === "yellow" || l.color === "red");

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>

      {/* Custom summary lines (e.g. Exa breakdown) */}
      {summaryLines && (
        <div className={`text-xs rounded px-2 py-1.5 space-y-0.5 ${
          hasProblemLines ? "bg-yellow-50 dark:bg-yellow-900/10" : "bg-green-50 dark:bg-green-900/20"
        }`}>
          <div className={`font-medium mb-1 ${hasProblemLines ? "text-yellow-700 dark:text-yellow-400" : "text-green-700 dark:text-green-400"}`}>
            {hasProblemLines ? "⚠ Done with issues" : "✓ Done"}
          </div>
          {summaryLines.map((line) => (
            <div key={line.label} className="flex justify-between">
              <span className="text-zinc-400">{line.label}</span>
              <span className={`font-medium ${colorClass(line.color)}`}>{line.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Generic summary (people search, haiku) */}
      {summary && !summaryLines && (
        <div className={`text-xs rounded px-2 py-1.5 space-y-0.5 ${
          allDone ? "bg-green-50 dark:bg-green-900/20" :
          hasFailed ? "bg-red-50 dark:bg-red-900/20" :
          "bg-zinc-50 dark:bg-zinc-800/50"
        }`}>
          <div className={`font-medium flex items-center gap-1 ${
            allDone ? "text-green-700 dark:text-green-400" :
            hasFailed ? "text-red-600 dark:text-red-400" :
            "text-zinc-600 dark:text-zinc-400"
          }`}>
            {allDone ? "✓ Done" : hasFailed ? "⚠ Partial" : "In progress"}
            <span className="font-normal text-zinc-400 ml-1">
              {summary.completed}/{summary.total} completed
            </span>
          </div>
          {hasFailed && <div className="text-red-500">{summary.failed} failed</div>}
          {hasSkipped && <div className="text-yellow-600 dark:text-yellow-400">{summary.skipped} skipped</div>}
        </div>
      )}

      {forceOption && (
        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
          <input
            type="checkbox"
            checked={forceOption.value}
            onChange={(e) => forceOption.onChange(e.target.checked)}
            className="rounded"
          />
          Force re-run
        </label>
      )}

      <button
        onClick={onRun}
        disabled={disabled}
        className={`w-full py-2 px-4 rounded text-sm font-medium transition-colors ${
          state === "running"
            ? "bg-yellow-500 text-white cursor-wait"
            : state === "done"
            ? "bg-green-600 text-white hover:bg-green-700"
            : state === "error"
            ? "bg-red-600 text-white hover:bg-red-700"
            : disabled
            ? "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {state === "running" ? "Running..." : state === "done" ? "Triggered" : state === "error" ? "Retry" : "Run"}
      </button>

      {runId && (
        <p className="text-xs text-zinc-400 font-mono truncate">
          Run: {runId}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
