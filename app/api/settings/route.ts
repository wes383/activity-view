import { connection, NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  settingsFileExists,
} from "@/lib/core/settings";

export async function GET() {
  await connection();
  return NextResponse.json({ settings: loadSettings(), persisted: settingsFileExists(), defaults: DEFAULT_SETTINGS });
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const next = sanitizeSettings(body);
  saveSettings(next);
  return NextResponse.json({ settings: next, persisted: true });
}
