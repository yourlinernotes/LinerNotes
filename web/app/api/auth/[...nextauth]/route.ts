import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";
import { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

// Wrap handlers to match Next.js 15 signature (params as Promise)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  return handler(request);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  return handler(request);
}
