import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function checkData() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        handle: true,
        displayName: true,
        email: true,
        _count: {
          select: { reviews: true },
        },
      },
    });

    console.log("\n=== USERS ===");
    users.forEach((user) => {
      console.log(
        `- ${user.displayName} (@${user.handle}) - ${user._count.reviews} reviews`
      );
      console.log(`  Profile URL: /profile/${user.handle}`);
    });

    // Get all reviews
    const reviews = await prisma.review.findMany({
      include: {
        user: {
          select: { handle: true, displayName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("\n=== REVIEWS ===");
    reviews.forEach((review) => {
      console.log(
        `- "${review.trackName}" by ${review.trackArtist} - ${review.rating}⭐`
      );
      console.log(`  By: ${review.user.displayName} (@${review.user.handle})`);
      console.log(`  Take: ${review.take || "(none)"}`);
      console.log(`  Created: ${review.createdAt}`);
      console.log();
    });

    console.log(`\nTotal users: ${users.length}`);
    console.log(`Total reviews: ${reviews.length}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkData();
