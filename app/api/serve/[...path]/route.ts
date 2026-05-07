export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignedReadUrl } from "@/lib/s3";
import { getContentType } from "@/lib/package-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const pathSegments = params?.path ?? [];
    if ((pathSegments?.length ?? 0) < 2) {
      return new NextResponse("Not found", { status: 404 });
    }

    const packageId = pathSegments?.[0] ?? "";
    const filePath = pathSegments?.slice(1)?.join("/") ?? "";

    // Find the package
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      return new NextResponse("Package not found", { status: 404 });
    }

    const s3Key = `${pkg.extractedPrefix}${filePath}`;
    const contentType = getContentType(filePath);

    // For HTML files that are SCORM, inject the SCORM API shim
    if (filePath === pkg?.entryPointPath && (pkg?.packageType?.startsWith?.("SCORM") || pkg?.packageType === "xAPI")) {
      // Fetch the HTML, inject SCORM API, then serve
      try {
        const { getObjectBuffer } = await import("@/lib/s3");
        const buffer = await getObjectBuffer(s3Key);
        let html = buffer?.toString("utf-8") ?? "";

        const scormShim = getScormShim(pkg.packageType);
        // Inject before </head> or at the start of <body>
        if (html?.includes?.("</head>")) {
          html = html.replace("</head>", `<script>${scormShim}</script></head>`);
        } else if (html?.includes?.("<body")) {
          html = html.replace(/<body([^>]*)>/, `<body$1><script>${scormShim}</script>`);
        } else {
          html = `<script>${scormShim}</script>${html}`;
        }

        return new NextResponse(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (innerErr: any) {
        console.error("Failed to inject SCORM shim:", innerErr?.message);
      }
    }

    // For all other files, redirect to signed S3 URL
    const signedUrl = await getSignedReadUrl(s3Key, contentType);
    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error("Serve error:", error?.message);
    return new NextResponse("File not found", { status: 404 });
  }
}

function getScormShim(packageType: string): string {
  if (packageType === "xAPI") {
    return `
// Minimal xAPI/Tin Can stub
window.TinCan = window.TinCan || {};
window.ADL = window.ADL || { XAPIWrapper: { changeConfig: function(){}, sendStatement: function(s,c){ if(c) c(); }, getState: function(){ return null; }, sendState: function(){} } };
console.log("[Embed Tool] xAPI stub loaded - no tracking");
`;
  }

  return `
// Minimal SCORM API implementation (no tracking)
(function() {
  var data = {};
  
  // SCORM 1.2 API
  var API = {
    LMSInitialize: function() { console.log("[SCORM 1.2] LMSInitialize"); return "true"; },
    LMSFinish: function() { console.log("[SCORM 1.2] LMSFinish"); return "true"; },
    LMSGetValue: function(key) { return data[key] || ""; },
    LMSSetValue: function(key, value) { data[key] = value; return "true"; },
    LMSCommit: function() { return "true"; },
    LMSGetLastError: function() { return "0"; },
    LMSGetErrorString: function() { return "No error"; },
    LMSGetDiagnostic: function() { return "No error"; }
  };
  
  // SCORM 2004 API
  var API_1484_11 = {
    Initialize: function() { console.log("[SCORM 2004] Initialize"); return "true"; },
    Terminate: function() { console.log("[SCORM 2004] Terminate"); return "true"; },
    GetValue: function(key) { return data[key] || ""; },
    SetValue: function(key, value) { data[key] = value; return "true"; },
    Commit: function() { return "true"; },
    GetLastError: function() { return "0"; },
    GetErrorString: function() { return "No error"; },
    GetDiagnostic: function() { return "No error"; }
  };
  
  // Register APIs at all window levels (SCORM searches up the frame hierarchy)
  window.API = API;
  window.API_1484_11 = API_1484_11;
  
  // Also set on parent if we are in an iframe
  try {
    if (window.parent && window.parent !== window) {
      window.parent.API = API;
      window.parent.API_1484_11 = API_1484_11;
    }
  } catch(e) {}
  
  console.log("[Embed Tool] SCORM API stub loaded - exercises will work without tracking");
})();
`;
}
