"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

export default function PipelinePage() {
  const [query, setQuery] = useState("");
  const [play, setPlay] = useState("");
  const [numResults, setNumResults] = useState(25);

  const [exaState, setExaState] = useState<StepState>("idle");
  const [apolloSearchState, setApolloSearchState] = useState<StepState>("idle");
  const [haikuState, setHaikuState] = useState<StepState>("idle");
  const [apolloState, setApolloState] = useState<StepState>("idle");

  const [exaRunId, setExaRunId] = useState<string | null>(null);
  const [apolloSearchRunId, setApolloSearchRunId] = useState<string | null>(null);
  const [haikuRunId, setHaikuRunId] = useState<string | null>(null);
  const [apolloRunId, setApolloRunId] = useState<string | null>(null);

  const [exaError, setExaError] = useState<string | null>(null);
  const [apolloSearchError, setApolloSearchError] = useState<string | null>(null);
  const [haikuError, setHaikuError] = useState<string | null>(null);
  const [apolloError, setApolloError] = useState<string | null>(null);

  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [enrichResults, setEnrichResults] = useState<EnrichmentResult[]>([]);
  const [exaCompanies, setExaCompanies] = useState<ExaCompany[]>([]);

  // Keep polling for 90s after any trigger, even though the API call returns instantly
  const pollUntilRef = useRef<number>(0);

  const isAnyRunning = exaState === "running" || apolloSearchState === "running" || haikuState === "running" || apolloState === "running";
  const shouldPoll = isAnyRunning || Date.now() < pollUntilRef.current;

  // Sync play name to query
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setPlay(val);
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
      // ignore fetch errors during polling
    }
  }, [play]);

  // Poll every 5s while running or within the poll window
  useEffect(() => {
    if (!play) return;

    // Initial fetch
    fetchResults();

    const id = setInterval(() => {
      const stillPolling = isAnyRunning || Date.now() < pollUntilRef.current;
      if (stillPolling) {
        fetchResults();
      }
    }, 5000);

    return () => clearInterval(id);
  }, [play, isAnyRunning, fetchResults]);

  async function triggerFlow(
    endpoint: string,
    params: Record<string, unknown>,
    setRunState: (s: StepState) => void,
    setRunId: (id: string | null) => void,
    setError: (e: string | null) => void,
  ) {
    setRunState("running");
    setError(null);
    // Keep polling for 90s after trigger
    pollUntilRef.current = Date.now() + 90_000;
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
      }
    } catch (err) {
      setRunState("error");
      setError(String(err));
    }
  }

  const runExa = () =>
    triggerFlow("/api/pipeline/exa", { query, play, numResults }, setExaState, setExaRunId, setExaError);
  const runApolloSearch = () =>
    triggerFlow("/api/pipeline/apollo-search", { play }, setApolloSearchState, setApolloSearchRunId, setApolloSearchError);
  const runHaiku = () =>
    triggerFlow("/api/pipeline/haiku", { play }, setHaikuState, setHaikuRunId, setHaikuError);
  const runApollo = () =>
    triggerFlow("/api/pipeline/apollo", { play }, setApolloState, setApolloRunId, setApolloError);

  const isAnyTriggered = exaState === "done" || apolloSearchState === "done" || haikuState === "done" || apolloState === "done";

  return (
    <div className="space-y-8">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FlowCard
          title="1. Exa Search"
          description="Search Exa, dedupe, scrape phones"
          state={exaState}
          runId={exaRunId}
          error={exaError}
          disabled={!query || !play || isAnyRunning}
          onRun={runExa}
        />
        <FlowCard
          title="2. Apollo People Search"
          description="Find people at each company (free)"
          state={apolloSearchState}
          runId={apolloSearchRunId}
          error={apolloSearchError}
          disabled={!play || isAnyRunning}
          onRun={runApolloSearch}
        />
        <FlowCard
          title="3. Haiku Screen"
          description="AI screening of each person"
          state={haikuState}
          runId={haikuRunId}
          error={haikuError}
          disabled={!play || isAnyRunning}
          onRun={runHaiku}
        />
        <FlowCard
          title="4. Apollo Enrich"
          description="Match emails for approved people (1 credit each)"
          state={apolloState}
          runId={apolloRunId}
          error={apolloError}
          disabled={!play || isAnyRunning}
          onRun={runApollo}
        />
      </div>

      {/* Polling indicator */}
      {(isAnyTriggered || isAnyRunning) && (
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Flow running on server — results will appear below as they come in
        </p>
      )}

      {/* Exa Results — companies found */}
      {exaCompanies.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Companies ({exaCompanies.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 pr-4">Company</th>
                  <th className="pb-2 pr-4">Domain</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                {exaCompanies.map((c, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-4">{c.company_name}</td>
                    <td className="py-1.5 pr-4 text-zinc-400">{c.domain}</td>
                    <td className="py-1.5 pr-4">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                        c.pipeline_status === "enriched" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                        c.pipeline_status === "phone_scraped" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {c.pipeline_status}
                      </span>
                    </td>
                    <td className="py-1.5 text-zinc-400">{c.phone_1 || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enrichment Results */}
      {enrichResults.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="font-semibold mb-3">Enrichment Results ({enrichResults.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 pr-4">Company</th>
                  <th className="pb-2 pr-4">Domain</th>
                  <th className="pb-2 pr-4">Person</th>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2">Approved</th>
                </tr>
              </thead>
              <tbody>
                {enrichResults.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-4">{r.company_name}</td>
                    <td className="py-1.5 pr-4 text-zinc-400">{r.domain}</td>
                    <td className="py-1.5 pr-4">{r.person_name || "-"}</td>
                    <td className="py-1.5 pr-4">{r.person_title || "-"}</td>
                    <td className="py-1.5 pr-4">{r.person_email || "-"}</td>
                    <td className="py-1.5">
                      {r.worth_enriching === true ? "Yes" : r.worth_enriching === false ? "No" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
}: {
  title: string;
  description: string;
  state: StepState;
  runId: string | null;
  error: string | null;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>

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
