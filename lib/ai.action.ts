import type {Generate3DViewParams} from "../type";
import puter from "@heyputer/puter.js";
import {ROOMIFY_RENDER_PROMPT} from "./constants";
import {isHostedUrl} from "./utils";

export async function fetchAsDataUrl(url: string): Promise<string> {
  // If it's a Puter hosted URL, try to read it directly from Puter FS
  if (isHostedUrl(url)) {
      try {
          const parsedUrl = new URL(url);
          const path = parsedUrl.pathname;
          // pathname usually starts with /
          const cleanPath = path.startsWith('/') ? path.substring(1) : path;
          console.log(`[ai:fetch] reading from Puter FS: ${cleanPath}`);
          const blob = await puter.fs.read(cleanPath);
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  if (typeof reader.result === "string") resolve(reader.result);
                  else reject(new Error("Failed to convert Puter blob to data URL"));
              };
              reader.onerror = () => reject(new Error("Error reading Puter blob"));
              reader.readAsDataURL(blob);
          });
      } catch (e) {
          console.warn("Failed to read image from Puter FS, falling back to fetch", e);
      }
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.error("Fetch failed for URL:", url, "Status:", response.status, response.statusText);
    throw new Error(`Failed to fetch image: ${response.statusText} (${response.status}) at ${url}`);
  }
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to data URL"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Error reading blob"));
    };
    reader.readAsDataURL(blob);
  });
}

export const generate3DView = async ({sourceImage}: Generate3DViewParams) => {
    const dataUrl = sourceImage.startsWith("data:")
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.split(';')[0].split(':')[1];

    if (!mimeType || !base64Data) throw new Error(('Invalid source image payload'));

    const response = await puter.ai.txt2img(ROOMIFY_RENDER_PROMPT, {
      provider: 'gemini',
      model: 'gemini-2.5-flash-image-preview',
      input_image: base64Data,
      input_image_mime_type: mimeType,
      ratio: {w: 1024, h: 1024}
    })

    const rawImageUrl = (response as HTMLImageElement).src ?? null

    if (!rawImageUrl) return { renderedImage: null, renderedPath: undefined };

    // Return the data URL directly, let createProject handle the hosting
    return { renderedImage: rawImageUrl, renderedPath: undefined };
}
