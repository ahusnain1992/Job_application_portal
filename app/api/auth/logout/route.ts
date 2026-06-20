import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  clearSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
