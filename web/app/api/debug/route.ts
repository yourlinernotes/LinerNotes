import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/debug - Debug endpoint to view database contents
 * TODO: Remove this in production or add authentication!
 */
export async function GET() {
  try {
    // Get all users with review counts
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

    // Get all reviews
    const reviews = await prisma.review.findMany({
      include: {
        user: {
          select: { handle: true, displayName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      users,
      reviews,
      stats: {
        totalUsers: users.length,
        totalReviews: reviews.length,
      },
    });
  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug data", details: String(error) },
      { status: 500 }
    );
  }
}
