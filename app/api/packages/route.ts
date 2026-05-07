export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      orderBy: { uploadDate: "desc" },
    });
    return NextResponse.json({ packages: packages ?? [] });
  } catch (error: any) {
    console.error("Failed to fetch packages:", error?.message);
    return NextResponse.json({ packages: [] }, { status: 500 });
  }
}
