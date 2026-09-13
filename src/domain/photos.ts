import { z } from "zod";

export const PHOTO_MAX_BYTES = 200 * 1024;
export const PHOTO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_EDGE = 1200;

// Local, optimized raster images only. Remote URLs and SVG are not stored in the demo.
export const productPhotoSchema = z
  .string()
  .max(
    Math.ceil(PHOTO_MAX_BYTES / 3) * 4 + 23,
    "A foto otimizada deve ter até 200 KB.",
  )
  .regex(
    /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    "Envie a foto pelo seletor de arquivos.",
  );

export const catalogName = (name: string) =>
  name
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
