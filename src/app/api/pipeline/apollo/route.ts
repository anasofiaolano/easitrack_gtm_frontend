import { NextResponse } from "next/server";

export const maxDuration = 30;

const PREFECT_API_URL = process.env.PREFECT_API_URL!;

async function getDeploymentId(name: string): Promise<string | null> {
  const res = await fetch(`${PREFECT_API_URL}/deployments/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deployments: { name: { any_: [name] } } }),
  });
  if (!res.ok) return null;
  const deps = await res.json();
  return deps[0]?.id ?? null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { play, runId } = body as { play: string; runId?: string };

  if (!play) {
    return NextResponse.json({ error: "play is required" }, { status: 400 });
  }

  if (!PREFECT_API_URL) {
    return NextResponse.json({ error: "PREFECT_API_URL not configured" }, { status: 500 });
  }

  const depId = await getDeploymentId("apollo-enrich");
  if (!depId) {
    return NextResponse.json({ error: "apollo-enrich deployment not found" }, { status: 500 });
  }

  try {
    const res = await fetch(`${PREFECT_API_URL}/deployments/${depId}/create_flow_run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parameters: { play, run_id: runId || null },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Prefect API error: ${res.status} ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ runId: data.id, state: data.state?.type });
  } catch (err) {
    return NextResponse.json({ error: `Failed to trigger flow: ${err}` }, { status: 502 });
  }
}
