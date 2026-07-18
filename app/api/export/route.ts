import { NextResponse } from "next/server";
import { exportAll } from "@db/portability";
import { getCurrentUser } from "@/lib/auth";

// GET /api/export — download the whole instance as JSON (auth required).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bundle = await exportAll();
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="dontcrossme-export-${Date.now()}.json"`,
    },
  });
}
