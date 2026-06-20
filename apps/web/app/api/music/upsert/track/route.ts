import { NextResponse } from "next/server";

/**
 * POST /api/music/upsert/track — NOT IMPLEMENTED (stubbed).
 *
 * The original implementation called `prisma.track.upsert`, but there is no
 * `Track` model in the schema, so it broke the type-check / Vercel build. This
 * endpoint is currently unused (track metadata is stored denormalised on
 * Review). Re-implement once a `Track` model + migration are added.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Track upsert not implemented (no Track model yet)" },
    { status: 501 }
  );
}
