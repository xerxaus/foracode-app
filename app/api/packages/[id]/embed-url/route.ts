export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: params?.id ?? "" },
    });
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Build the serve URL for this package
    const host = request?.headers?.get("x-forwarded-host") ?? request?.headers?.get("host") ?? "localhost:3000";
    const protocol = request?.headers?.get("x-forwarded-proto") ?? "https";
    const baseUrl = `${protocol}://${host}`;
    const serveUrl = `${baseUrl}/api/serve/${pkg.id}/${pkg.entryPointPath}`;

    return NextResponse.json({
      embedUrl: serveUrl,
      embedCode: `<iframe src="${serveUrl}" width="100%" height="600" frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe>`,
      packageType: pkg?.packageType,
    });
  } catch (error: any) {
    console.error("Failed to get embed URL:", error?.message);
    return NextResponse.json({ error: "Failed to generate embed URL" }, { status: 500 });
  }
}
