import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const s3 = createS3Client();

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
) {
  const { bucketName, folderPrefix } = getBucketConfig();
  const prefix = isPublic ? `${folderPrefix}public/uploads` : `${folderPrefix}uploads`;
  const cloud_storage_path = `${prefix}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

export async function uploadBuffer(
  cloud_storage_path: string,
  buffer: Buffer,
  contentType: string,
  isPublic: boolean = true
) {
  const { bucketName } = getBucketConfig();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    Body: buffer,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });
  await s3.send(command);
}

export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean = false
) {
  const { bucketName } = getBucketConfig();
  if (isPublic) {
    const region = process.env.AWS_REGION ?? "us-east-1";
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: "attachment",
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function getSignedReadUrl(
  cloud_storage_path: string,
  contentType?: string
) {
  const { bucketName } = getBucketConfig();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ...(contentType ? { ResponseContentType: contentType } : {}),
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteFile(cloud_storage_path: string) {
  const { bucketName } = getBucketConfig();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  await s3.send(command);
}

export async function deleteByPrefix(prefix: string) {
  const { bucketName } = getBucketConfig();
  let continuationToken: string | undefined;
  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const result = await s3.send(listCmd);
    const contents = result?.Contents ?? [];
    for (const obj of contents) {
      if (obj?.Key) {
        await deleteFile(obj.Key);
      }
    }
    continuationToken = result?.NextContinuationToken;
  } while (continuationToken);
}

export async function getObjectBuffer(cloud_storage_path: string): Promise<Buffer> {
  const { bucketName } = getBucketConfig();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  const response = await s3.send(command);
  const stream = response?.Body;
  if (!stream) throw new Error("Empty response body");
  const chunks: Uint8Array[] = [];
  // @ts-ignore - stream is readable
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
