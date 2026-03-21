import { NextResponse } from "next/server";
import { drizzleDb } from "@/lib/db";
import { categories } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";

export const revalidate = 60;

export const GET = async () => {
  try {
    const list = await drizzleDb
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return NextResponse.json(
      { data: list },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}
