import { NextRequest, NextResponse } from "next/server";
import { importAll, type ExportBundle } from "@db/portability";
import { getCurrentUser, canReview } from "@/lib/auth";

// POST /api/import — restore a JSON export into an EMPTY database (admin only).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canReview(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let bundle: ExportBundle;
  try {
    bundle = (await req.json()) as ExportBundle;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await importAll(bundle);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 },
    );
  }
}
