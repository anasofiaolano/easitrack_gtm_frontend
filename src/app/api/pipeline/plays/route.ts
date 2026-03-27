import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT p.id, p.name, p.created_at,
              COUNT(cp.company_id) AS company_count
       FROM plays p
       LEFT JOIN company_plays cp ON cp.play_id = p.id
       GROUP BY p.id, p.name, p.created_at
       ORDER BY p.created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Plays query error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
