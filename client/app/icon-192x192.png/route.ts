import { createPwaIconResponse } from "@/lib/pwa-icon";

export const runtime = "nodejs";

export async function GET() {
  return createPwaIconResponse(192);
}