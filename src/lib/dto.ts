import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const projectListQuerySchema = paginationSchema.extend({
  sort: z.enum(["createdAt", "marketCap"]).default("createdAt"),
  search: z.string().trim().optional(),
});

export const projectIdSchema = z.object({
  id: z.string().cuid(),
});

export const projectCreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(30).max(2_000),
  tokenSymbol: z
    .string()
    .regex(/^[A-Z0-9]{3,8}$/, "Simge 3-8 karakter, büyük harf/rakam olmalıdır."),
  tokenSupply: z.coerce.number().int().min(1_000),
  ownershipPercent: z.coerce.number().min(1).max(100),
  creatorAddress: z.string().min(10),
});

export const orderCreateSchema = z.object({
  projectId: z.string().cuid(),
  wallet: z.string().min(10),
  side: z.enum(["BUY", "SELL"]),
  tokenAmount: z.coerce.number().positive(),
  pricePerToken: z.coerce.number().positive(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(64),
});

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type ProjectIdParam = z.infer<typeof projectIdSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
