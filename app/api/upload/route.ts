export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadBuffer } from "@/lib/s3";
import { analyzePackage, getContentType } from "@/lib/package-utils";
import { getBucketConfig } from "@/lib/aws-config";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData?.get("file") as File | null;
    const customName = (formData?.get("name") as string) ?? "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = customName || file?.name || "package.zip";
    const fileSize = file?.size ?? 0;

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // Analyze the package
    const packageInfo = analyzePackage(zipBuffer);

    // Generate unique prefix for this package
    const { folderPrefix } = getBucketConfig();
    const packageId = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const extractedPrefix = `${folderPrefix}public/packages/${packageId}/`;

    // Upload ZIP file
    const zipPath = `${folderPrefix}uploads/${Date.now()}-${fileName}`;
    await uploadBuffer(zipPath, zipBuffer, "application/zip", false);

    // Upload all extracted files to S3 as public
    for (const extracted of (packageInfo?.files ?? [])) {
      const filePath = extracted?.path ?? "";
      if (!filePath) continue;
      const s3Key = `${extractedPrefix}${filePath}`;
      const contentType = getContentType(filePath);
      await uploadBuffer(s3Key, extracted.content, contentType, true);
    }

    // Save to database
    const entryPointPath = packageInfo?.entryPoint ?? "index.html";
    const pkg = await prisma.package.create({
      data: {
        name: fileName?.replace(/\.zip$/i, "") ?? "Untitled",
        packageType: packageInfo?.packageType ?? "HTML5",
        fileSize,
        zipStoragePath: zipPath,
        extractedPrefix,
        entryPointPath,
        isPublic: true,
      },
    });

    return NextResponse.json({
      success: true,
      package: pkg,
    });
  } catch (error: any) {
    console.error("Upload failed:", error?.message, error?.stack);
    return NextResponse.json(
      { error: error?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
