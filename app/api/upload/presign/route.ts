export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";

/**
 * POST /api/upload/presign
 *
 * Sadece bir Presigned PUT URL üretir; dosya Vercel'e hiç gelmez.
 *
 * Body: { fileName: string; contentType: string }
 * Response: { presignedUrl: string; zipStoragePath: string; packageId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fileName: string = body?.fileName ?? "package.zip";
    const contentType: string = body?.contentType ?? "application/zip";

    const s3 = createS3Client();
    const { bucketName, folderPrefix } = getBucketConfig();

    // Benzersiz packageId ve S3 yolu üret
    const packageId = `pkg-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    const zipStoragePath = `${folderPrefix}uploads/${packageId}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: zipStoragePath,
      ContentType: contentType,
    });

    // 15 dakika geçerli presigned URL
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    return NextResponse.json({ presignedUrl, zipStoragePath, packageId });
  } catch (error: any) {
    console.error("Presign failed:", error?.message);
    return NextResponse.json(
      { error: error?.message ?? "Presign failed" },
      { status: 500 }
    );
  }
}
