import { connection, NextResponse } from "next/server";
import { checkStatus } from "@/lib/aw/client";
import { loadSettings, settingsFileExists } from "@/lib/core/settings";

export async function GET() {
  // Reading the file system and the local watcher both have to happen per
  // request; without this the handler would be prerendered at build time.
  await connection();
  const settings = loadSettings();
  const status = await checkStatus(settings);
  return NextResponse.json({ ...status, persistedSettings: settingsFileExists(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}
