import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_UPLOAD_MAX_BYTES,
  productPhotoSchema,
} from "../domain/photos";

const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
const invalidFile = "Escolha uma foto JPG, PNG ou WebP válida.";

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new Error(
                "Não foi possível otimizar a foto. Tente outra imagem.",
              ),
            ),
      type,
      0.82,
    );
  });
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error(invalidFile));
    reader.onerror = () =>
      reject(new Error("Não foi possível ler a foto. Tente novamente."));
    reader.readAsDataURL(blob);
  });
}

/** Decode and re-encode locally; only the optimized image is saved with the product. */
export async function preparePhoto(file: File): Promise<string> {
  if (!file.size) throw new Error(invalidFile);
  if (file.size > PHOTO_UPLOAD_MAX_BYTES)
    throw new Error("A foto deve ter até 10 MB. Escolha um arquivo menor.");
  if (file.type && !supportedTypes.includes(file.type))
    throw new Error(invalidFile);
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (byte, i) => header[i] === byte,
  );
  const webp =
    [82, 73, 70, 70].every((byte, i) => header[i] === byte) &&
    [87, 69, 66, 80].every((byte, i) => header[i + 8] === byte);
  if (!jpeg && !png && !webp) throw new Error(invalidFile);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Não foi possível abrir esta foto. O arquivo pode estar corrompido; escolha outra imagem.",
    );
  }
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 48_000_000
    )
      throw new Error(
        "A foto deve ter até 48 megapixels. Reduza a resolução e tente novamente.",
      );
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Seu navegador não conseguiu preparar a foto. Tente novamente.",
      );
    const scale = Math.min(
      1,
      PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    for (let attempt = 0; attempt < 6; attempt++) {
      const ratio = scale * Math.pow(0.82, attempt);
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      context.fillStyle = "#211c16";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let optimized = await encode(canvas, "image/webp");
      if (optimized.type !== "image/webp")
        optimized = await encode(canvas, "image/jpeg");
      if (optimized.size <= PHOTO_MAX_BYTES)
        return productPhotoSchema.parse(await dataUrl(optimized));
    }
    throw new Error(
      "Não foi possível reduzir esta foto para 200 KB. Escolha outra imagem.",
    );
  } finally {
    bitmap.close();
  }
}
