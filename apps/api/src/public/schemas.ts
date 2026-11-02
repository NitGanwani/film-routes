import { z } from 'zod';

export const PUBLIC_SORTS = ['new', 'popular'] as const;
export type PublicSort = (typeof PUBLIC_SORTS)[number];

export const MAX_PAGE_SIZE = 50;
// Deep pages are the expensive ones; nobody browses a hundred pages.
const MAX_PAGE = 100;

export const listQuerySchema = z.object({
  sort: z.enum(PUBLIC_SORTS).default('new'),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type ListQuery = z.output<typeof listQuerySchema>;
