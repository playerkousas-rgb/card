const TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export async function readImage(file) {
  if (!TYPES.has(file.type))
    throw new Error("請上傳 PNG、JPG、WEBP、GIF 或 SVG 圖片。");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("每張圖片上限為 20 MB，請先縮小圖片。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error(`無法讀取「${file.name}」，請換另一張圖片。`);
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("圖片尺寸無效。");
    // About 575 dpi at 88 mm: comfortably above normal 300 dpi card printing.
    const scale = Math.min(
      1,
      2000 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器未能處理圖片。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Rasterizing SVG also prevents external references being carried into a
    // saved project. Keep transparency for logos; photos use smaller JPEGs.
    return canvas.toDataURL(
      file.type === "image/jpeg" ? "image/jpeg" : "image/png",
      0.92,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
