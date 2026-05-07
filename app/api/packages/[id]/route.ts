export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteByPrefix, deleteFile } from "@/lib/s3";

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
    return NextResponse.json({ package: pkg });
  } catch (error: any) {
    console.error("Failed to fetch package:", error?.message);
    return NextResponse.json({ error: "Failed to fetch package" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Delete extracted files from S3
    if (pkg?.extractedPrefix) {
      await deleteByPrefix(pkg.extractedPrefix);
    }
    // Delete ZIP file from S3
    if (pkg?.zipStoragePath) {
      await deleteFile(pkg.zipStoragePath);
    }

    // Delete from database
    await prisma.package.delete({
      where: { id: params?.id ?? "" },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete package:", error?.message);
    return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
  }
}
