import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const base64 = authHeader.slice("Basic ".length);
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const colonIndex = decoded.indexOf(":");
    const password = decoded.slice(colonIndex + 1);

    if (password === process.env.DASHBOARD_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="EasyTrack Dashboard"',
    },
  });
}

export const config = {
  // Protect everything. Add paths to exclude here if needed (e.g. /api/health).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
