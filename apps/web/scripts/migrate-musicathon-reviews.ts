#!/usr/bin/env tsx
/**
 * Migrate review entries from the Musicathon demo DB into the beta DB.
 *
 * Copies each mapped user's own track reviews + album reviews, including the
 * timestamped notes (and their `lyric` text — already stored, so no Musixmatch
 * call is needed). Social rows (likes/reposts/saves/friendships) are NOT copied,
 * since they reference demo-only users.
 *
 * SAFETY: dry-run by default. Prints exactly what it would insert. Pass --commit
 * to actually write to the beta DB.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=<demo db url> \
 *   TARGET_DATABASE_URL=<beta prod db url> \
 *   npx tsx scripts/migrate-musicathon-reviews.ts            # dry run
 *   ... --commit                                             # write
 *
 * Required: the beta Note table must already have the `lyric` column
 * (prisma migrate / db push after adding it to schema.prisma).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// demo handle  ->  beta account identifier (email preferred; handle as fallback)
const USER_MAP: Array<{ sourceHandle: string; targetEmail?: string; targetHandle?: string }> = [
  { sourceHandle: "anushaisawesome", targetEmail: "anushaupadh@gmail.com" }, // demo @hotmail -> beta @gmail
  { sourceHandle: "abia",            targetEmail: "13abiazt@gmail.com" },     // same email both sides
];

const COMMIT = process.argv.includes("--commit");

function client(url: string | undefined, name: string) {
  if (!url) throw new Error(`Missing ${name}`);
  const pool = new Pool({ connectionString: url });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

async function main() {
  if (USER_MAP.length === 0) throw new Error("USER_MAP is empty — map demo handles to beta accounts first.");

  const src = client(process.env.SOURCE_DATABASE_URL, "SOURCE_DATABASE_URL");
  const dst = client(process.env.TARGET_DATABASE_URL, "TARGET_DATABASE_URL");

  console.log(COMMIT ? "✍️  MODE: COMMIT (writing)\n" : "🔍 MODE: DRY RUN (no writes)\n");

  try {
    for (const map of USER_MAP) {
      const srcUser = await src.prisma.user.findFirst({ where: { handle: map.sourceHandle } });
      if (!srcUser) { console.error(`✗ source user @${map.sourceHandle} not found — skipping`); continue; }

      const dstUser = await dst.prisma.user.findFirst({
        where: map.targetEmail ? { email: map.targetEmail } : { handle: map.targetHandle },
      });
      if (!dstUser) { console.error(`✗ beta user ${map.targetEmail ?? map.targetHandle} not found — skipping`); continue; }

      console.log(`\n=== @${map.sourceHandle} → ${dstUser.email} (${dstUser.id}) ===`);

      // Dedup keys: what the beta account already has, so we don't double-import.
      const existingTrackIds = new Set(
        (await dst.prisma.review.findMany({ where: { userId: dstUser.id }, select: { trackId: true } })).map(r => r.trackId),
      );
      const existingAlbumIds = new Set(
        (await dst.prisma.albumReview.findMany({ where: { userId: dstUser.id }, select: { albumId: true } })).map(a => a.albumId),
      );

      // Standalone track reviews (not part of an album review), minus ones already in beta
      const standaloneAll = await src.prisma.review.findMany({
        where: { userId: srcUser.id, albumReviewId: null },
        include: { notes: { orderBy: { createdAt: "asc" } } },
      });
      const standalone = standaloneAll.filter(r => !existingTrackIds.has(r.trackId));
      const skippedTracks = standaloneAll.length - standalone.length;

      // Album reviews with their per-track reviews + notes, minus ones already in beta
      const albumsAll = await src.prisma.albumReview.findMany({
        where: { userId: srcUser.id },
        include: { trackReviews: { include: { notes: { orderBy: { createdAt: "asc" } } } } },
      });
      const albums = albumsAll.filter(a => !existingAlbumIds.has(a.albumId));
      const skippedAlbums = albumsAll.length - albums.length;

      const noteCount = (rs: typeof standalone) => rs.reduce((n, r) => n + r.notes.length, 0);
      console.log(`  beta already has: ${existingTrackIds.size} track reviews, ${existingAlbumIds.size} album reviews`);
      console.log(`  → ${standalone.length} new standalone reviews (${noteCount(standalone)} notes)${skippedTracks ? `, ${skippedTracks} skipped as dupes` : ""}`);
      console.log(`  → ${albums.length} new album reviews (${albums.reduce((n, a) => n + a.trackReviews.length, 0)} track reviews)${skippedAlbums ? `, ${skippedAlbums} skipped as dupes` : ""}`);

      if (!COMMIT) {
        for (const r of standalone)
          console.log(`    • ${r.trackName} — ${r.trackArtist} (${r.rating}★, ${r.notes.length} notes, ${r.notes.filter(n => n.lyric).length} w/ lyric)`);
        for (const a of albums)
          console.log(`    ◆ [album] ${a.albumName} — ${a.albumArtist} (${a.trackReviews.length} tracks)`);
        continue;
      }

      // --- COMMIT ---
      await dst.prisma.$transaction(async (tx) => {
        // many inserts over a remote DB — well past the 5s default
        for (const r of standalone) {
          const { id, userId, albumReviewId, notes, createdAt, updatedAt, ...data } = r;
          await tx.review.create({
            data: { ...data, userId: dstUser.id, createdAt, updatedAt,
              notes: { create: notes.map(({ id, reviewId, createdAt, ...n }) => ({ ...n, createdAt })) } },
          });
        }
        for (const a of albums) {
          const { id, userId, trackReviews, createdAt, updatedAt, ...adata } = a;
          // Create the album review first, then its track reviews (each with notes
          // nested — 2 levels, which Prisma 7 handles; 3-level nesting trips a FK bug).
          const createdAlbum = await tx.albumReview.create({
            data: { ...adata, userId: dstUser.id, createdAt, updatedAt },
          });
          for (const t of trackReviews) {
            const { id, userId, albumReviewId, notes, createdAt, updatedAt, ...tr } = t;
            await tx.review.create({
              data: { ...tr, userId: dstUser.id, albumReviewId: createdAlbum.id, createdAt, updatedAt,
                notes: { create: notes.map(({ id, reviewId, createdAt, ...n }) => ({ ...n, createdAt })) } },
            });
          }
        }
      }, { maxWait: 20000, timeout: 180000 });
      console.log(`  ✅ copied`);
    }
  } finally {
    await src.prisma.$disconnect(); await src.pool.end();
    await dst.prisma.$disconnect(); await dst.pool.end();
  }
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
