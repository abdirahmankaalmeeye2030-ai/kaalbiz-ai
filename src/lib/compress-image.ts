const HEIC_MESSAGE =
  "This photo is HEIC, which this browser can't read. Export it as a JPEG, or take the photo again.";

function isHeicFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

export async function compressImage(
  file: File,
): Promise<{ base64: string; mimeType: "image/jpeg"; previewUrl: string }> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decodeImage(file);
  } catch (error) {
    if (isHeicFile(file)) throw new Error(HEIC_MESSAGE);
    throw error;
  }
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) {
    if ("close" in source && typeof source.close === "function") source.close();
    throw new Error(isHeicFile(file) ? HEIC_MESSAGE : "Could not read that image.");
  }
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source && typeof source.close === "function") source.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.72);
  });
  if (!blob) throw new Error("Could not compress that image.");

  return {
    base64: await blobToBase64(blob),
    mimeType: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
  };
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the image element.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not prepare that image."));
    reader.readAsDataURL(blob);
  });
}
