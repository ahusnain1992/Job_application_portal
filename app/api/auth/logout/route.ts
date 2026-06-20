import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: NextRequest) {
  clearSession();
  return redirectTo("/");
}
