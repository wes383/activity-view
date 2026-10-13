import { NextResponse } from "next/server";
import { clearEventCache } from "@/lib/aw/client";

export async function POST() {
  clearEventCache();
  return NextResponse.json({ ok: true });
}
