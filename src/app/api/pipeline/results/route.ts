import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const play = searchParams.get("play");

  if (!play) {
    return NextResponse.json({ error: "play is required" }, { status: 400 });
  }

  try {
    if (type === "logs") {
      const rows = await query(
        `SELECT c.company_name, c.domain, psl.step, psl.status, psl.details
         FROM pipeline_step_log psl
         JOIN companies c ON psl.company_id = c.id
         WHERE psl.company_id IN (
           SELECT cp.company_id FROM company_plays cp
           JOIN plays p ON cp.play_id = p.id
           WHERE p.name = $1
         )
         ORDER BY psl.created_at DESC
         LIMIT 200`,
        [play]
      );
      return NextResponse.json(rows);
    }

    if (type === "enrichment") {
      const rows = await query(
        `SELECT c.company_name, c.domain,
                er.person_name, er.person_title, er.person_email, er.worth_enriching
         FROM enrichment_results er
         JOIN companies c ON er.company_id = c.id
         WHERE er.company_id IN (
           SELECT cp.company_id FROM company_plays cp
           JOIN plays p ON cp.play_id = p.id
           WHERE p.name = $1
         )
         ORDER BY er.id DESC
         LIMIT 200`,
        [play]
      );
      return NextResponse.json(rows);
    }

    if (type === "companies") {
      const rows = await query(
        `SELECT c.company_name, c.domain, c.pipeline_status, c.phone_1
         FROM companies c
         WHERE c.id IN (
           SELECT cp.company_id FROM company_plays cp
           JOIN plays p ON cp.play_id = p.id
           WHERE p.name = $1
         )
         ORDER BY c.created_at DESC
         LIMIT 200`,
        [play]
      );
      return NextResponse.json(rows);
    }

    return NextResponse.json({ error: "type must be 'logs', 'enrichment', or 'companies'" }, { status: 400 });
  } catch (err) {
    console.error("Results query error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
