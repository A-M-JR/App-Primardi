import { NextResponse } from "next/server"
import { clearSession } from "@/lib/session"

/** Encerra a sessão removendo o cookie httpOnly. */
export async function POST() {
  await clearSession()
  return NextResponse.json({ success: true })
}
