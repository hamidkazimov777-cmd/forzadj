import { z } from "zod";

export const VERSION_TYPES = [
  "ORIGINAL",
  "CLEAN",
  "DIRTY",
  "INTRO",
  "OUTRO",
  "EXTENDED",
  "RADIO_EDIT",
  "ACAPELLA",
  "INSTRUMENTAL",
  "REMIX",
] as const;

/** Camelot: 1A–12A / 1B–12B. */
export const CAMELOT_KEYS = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(
  (n) => [`${n}A`, `${n}B`],
);

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const trackMetadataSchema = z.object({
  title: z.string().trim().min(1).max(300),
  year: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1900).max(2100).optional(),
  ),
  isExplicit: z.coerce.boolean().default(false),
  isrc: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i, "Неверный формат ISRC")
      .optional(),
  ),
  artistNames: z.string().default(""),
  featuredNames: z.string().default(""),
  genreNames: z.string().default(""),
});

export const versionMetadataSchema = z.object({
  type: z.enum(VERSION_TYPES),
  versionLabel: z.preprocess(
    emptyToUndef,
    z.string().trim().max(100).optional(),
  ),
  bpm: z.preprocess(
    emptyToUndef,
    z.coerce.number().min(40).max(250).optional(),
  ),
  musicalKey: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => CAMELOT_KEYS.includes(v), "Ключ в Camelot: 1A–12B")
      .optional(),
  ),
  energy: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(1).max(5).optional(),
  ),
  introSeconds: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(0).max(600).optional(),
  ),
  outroSeconds: z.preprocess(
    emptyToUndef,
    z.coerce.number().int().min(0).max(600).optional(),
  ),
  isExplicit: z.coerce.boolean().default(false),
});

export const uploadRequestSchema = z.object({
  name: z.string().min(1).max(300),
  mime: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});
