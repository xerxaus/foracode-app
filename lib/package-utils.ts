import AdmZip from "adm-zip";

export interface PackageInfo {
  packageType: string;
  entryPoint: string;
  files: { path: string; content: Buffer }[];
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".xsd": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".swf": "application/x-shockwave-flash",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".md": "text/markdown",
};

export function getContentType(filePath: string): string {
  const ext = (filePath?.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
  return CONTENT_TYPE_MAP[ext] ?? "application/octet-stream";
}

export function analyzePackage(zipBuffer: Buffer): PackageInfo {
  const zip = new AdmZip(zipBuffer);
  const entries = zip?.getEntries() ?? [];

  const filePaths = entries
    ?.filter((e: any) => !e?.isDirectory)
    ?.map((e: any) => e?.entryName ?? "") ?? [];

  // Detect package type
  const packageType = detectPackageType(filePaths);

  // Extract all files
  const files: { path: string; content: Buffer }[] = [];
  for (const entry of entries) {
    if (entry?.isDirectory) continue;
    const entryName = entry?.entryName ?? "";
    if (!entryName) continue;
    try {
      const content = entry?.getData();
      if (content) {
        files.push({ path: entryName, content });
      }
    } catch (err: any) {
      console.error(`Failed to extract ${entryName}:`, err?.message);
    }
  }

  // Find entry point
  const entryPoint = findEntryPoint(filePaths, packageType);

  return { packageType, entryPoint, files };
}

function detectPackageType(filePaths: string[]): string {
  const lower = filePaths?.map((p: string) => p?.toLowerCase?.() ?? "") ?? [];

  // Check for SCORM manifest
  const hasImsManifest = lower?.some((p: string) => p?.endsWith?.("imsmanifest.xml")) ?? false;
  if (hasImsManifest) {
    // Check for SCORM 2004 vs 1.2 by looking at metadata or common patterns
    const hasScorm2004Indicators = lower?.some(
      (p: string) =>
        p?.includes?.("adlcp_v1p3") ||
        p?.includes?.("scorm_2004") ||
        p?.includes?.("adlseq") ||
        p?.includes?.("adlnav")
    ) ?? false;
    return hasScorm2004Indicators ? "SCORM 2004" : "SCORM 1.2";
  }

  // Check for H5P
  const hasH5pJson = lower?.some((p: string) => p?.endsWith?.("h5p.json") || p === "h5p.json") ?? false;
  if (hasH5pJson) return "H5P";

  // Check for xAPI / Tin Can
  const hasTinCanXml = lower?.some(
    (p: string) => p?.endsWith?.("tincan.xml") || p?.endsWith?.("cmi5.xml")
  ) ?? false;
  if (hasTinCanXml) return "xAPI";

  // Default: HTML5 package
  return "HTML5";
}

function findEntryPoint(filePaths: string[], packageType: string): string {
  const lower = filePaths?.map((p: string) => ({
    lower: p?.toLowerCase?.() ?? "",
    original: p ?? "",
  })) ?? [];

  // SCORM: look for common Articulate entry points
  if (packageType?.startsWith?.("SCORM")) {
    const scormEntries = [
      "story.html",
      "story_html5.html",
      "index.html",
      "index_lms.html",
      "index_lms_html5.html",
      "scormdriver/indexapi.html",
      "scormcontent/index.html",
      "launch.html",
      "player.html",
      "res/index.html",
    ];
    for (const entry of scormEntries) {
      const found = lower?.find((p: any) => p?.lower?.endsWith?.(entry));
      if (found) return found?.original ?? "";
    }
  }

  // xAPI: look for launch page
  if (packageType === "xAPI") {
    const xapiEntries = ["index.html", "launch.html", "story.html"];
    for (const entry of xapiEntries) {
      const found = lower?.find((p: any) => p?.lower?.endsWith?.(entry));
      if (found) return found?.original ?? "";
    }
  }

  // H5P: content entry
  if (packageType === "H5P") {
    const found = lower?.find((p: any) => p?.lower?.endsWith?.("index.html"));
    if (found) return found?.original ?? "";
  }

  // Generic: find any index.html
  const indexHtml = lower?.find((p: any) => p?.lower?.endsWith?.("index.html"));
  if (indexHtml) return indexHtml?.original ?? "";

  // Last resort: any html file
  const anyHtml = lower?.find((p: any) => p?.lower?.endsWith?.(".html"));
  return anyHtml?.original ?? "index.html";
}
