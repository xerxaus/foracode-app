export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObjectBuffer, uploadBuffer } from "@/lib/s3";
import { analyzePackage, getContentType } from "@/lib/package-utils";
import { getBucketConfig } from "@/lib/aws-config";

/**
 * POST /api/upload/process
 *
 * İstemci S3'e doğrudan yükledikten sonra bu endpoint çağrılır.
 * ZIP dosyasını S3'ten okur, extract eder ve veritabanına kaydeder.
 *
 * Body: { zipStoragePath: string; packageId: string; fileName: string; fileSize: number }
 * Response: { success: true; package: Package }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zipStoragePath: string = body?.zipStoragePath ?? "";
    const packageId: string = body?.packageId ?? "";
    const fileName: string = body?.fileName ?? "package.zip";
    const fileSize: number = body?.fileSize ?? 0;

    if (!zipStoragePath || !packageId) {
      return NextResponse.json(
        { error: "zipStoragePath and packageId are required" },
        { status: 400 }
      );
    }

    // ZIP'i S3'ten oku (buffer olarak)
    const zipBuffer = await getObjectBuffer(zipStoragePath);

    // Paketi analiz et (SCORM/H5P/xAPI/HTML5 tespiti + dosya listesi)
    const packageInfo = analyzePackage(zipBuffer);

    // Extract edilmiş dosyaların S3 prefix'i
    const { folderPrefix } = getBucketConfig();
    const extractedPrefix = `${folderPrefix}public/packages/${packageId}/`;

    // Tüm extract edilmiş dosyaları S3'e yükle (public)
    for (const extracted of packageInfo?.files ?? []) {
      const filePath = extracted?.path ?? "";
      if (!filePath) continue;
      const s3Key = `${extractedPrefix}${filePath}`;
      const contentType = getContentType(filePath);
      await uploadBuffer(s3Key, extracted.content, contentType, true);
    }

    // Veritabanına kaydet
    const entryPointPath = packageInfo?.entryPoint ?? "index.html";
    const pkg = await prisma.package.create({
      data: {
        name: fileName?.replace(/\.zip$/i, "") ?? "Untitled",
        packageType: packageInfo?.packageType ?? "HTML5",
        fileSize,
        zipStoragePath,
        extractedPrefix,
        entryPointPath,
        isPublic: true,
      },
    });

    return NextResponse.json({ success: true, package: pkg });
  } catch (error: any) {
    console.error("Process failed:", error?.message, error?.stack);
    return NextResponse.json(
      { error: error?.message ?? "Processing failed" },
      { status: 500 }
    );
  }
}
