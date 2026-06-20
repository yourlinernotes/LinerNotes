import { NextResponse } from "next/server";

/**
 * POST /api/music/upsert/album — NOT IMPLEMENTED (stubbed).
 *
 * The original implementation called `prisma.album.upsert`, but there is no
 * `Album` model in the schema, so it broke the type-check / Vercel build. This
 * endpoint is currently unused (album metadata is stored denormalised on
 * AlbumReview). Re-implement once an `Album` model + migration are added.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Album upsert not implemented (no Album model yet)" },
    { status: 501 }
  );
}
