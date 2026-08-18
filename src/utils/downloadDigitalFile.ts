/**
 * Utility for triggering automated & manual digital file downloads
 * optimized for AWS S3 and cloud storage links.
 */

export interface DownloadResult {
  success: boolean;
  filename: string;
  error?: string;
}

/**
 * Derives a clean filename from a URL or item name & format
 */
export function getDigitalFileName(url: string, itemName?: string, format?: string): string {
  try {
    const urlObj = new URL(url, window.location.origin);
    const pathname = urlObj.pathname;
    const extractedName = pathname.split("/").pop();
    if (extractedName && extractedName.includes(".")) {
      return decodeURIComponent(extractedName);
    }
  } catch (_) {
    // If not a valid absolute/relative URL, continue to fallback
  }

  const cleanName = (itemName || "digital-asset")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const extMap: Record<string, string> = {
    pdf: "pdf",
    video: "mp4",
    audio: "mp3",
    zip: "zip",
    ebook: "epub",
    software: "zip",
    image: "jpg",
    other: "bin"
  };

  const ext = (format && extMap[format.toLowerCase()]) || "dat";
  return `${cleanName}.${ext}`;
}

/**
 * Triggers a direct file download to the user's local device.
 * Employs multi-tier strategies (Blob Fetch -> S3 Proxy -> Direct Anchor)
 * to ensure files are saved directly to disk rather than opening in browser tabs.
 */
export async function downloadDigitalFile(
  fileUrl: string,
  suggestedName?: string,
  format?: string
): Promise<DownloadResult> {
  if (!fileUrl || !fileUrl.trim()) {
    return { success: false, filename: "", error: "File URL is missing" };
  }

  const url = fileUrl.trim();
  const filename = suggestedName && suggestedName.includes(".") 
    ? suggestedName 
    : getDigitalFileName(url, suggestedName, format);

  // Strategy 1: Fetch as Blob with custom download attribute (best for AWS S3 & CORS-enabled buckets)
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        "Accept": "*/*"
      }
    });

    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 2000);

      return { success: true, filename };
    }
  } catch (corsErr) {
    console.info("[Digital Download] Direct blob fetch bypassed (CORS / S3 origin). Proceeding with S3 Proxy/Anchor Strategy:", corsErr);
  }

  // Strategy 2: Backend Download Proxy (/api/digital/download)
  try {
    const proxyUrl = `/api/digital/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const proxyRes = await fetch(proxyUrl, { method: "HEAD" });
    if (proxyRes.ok) {
      const link = document.createElement("a");
      link.href = proxyUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 2000);
      return { success: true, filename };
    }
  } catch (_) {
    // Proceed to Strategy 3
  }

  // Strategy 3: Standard Programmatic Anchor Tag
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 2000);

    return { success: true, filename };
  } catch (fallbackErr: any) {
    console.error("[Digital Download] All strategies failed:", fallbackErr);
    return { success: false, filename, error: fallbackErr?.message || "Failed to trigger download" };
  }
}
