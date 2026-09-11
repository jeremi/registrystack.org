import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default('Registry Stack'),
    audience: z.string(),
    category: z.enum(['Field guide', 'Decision guide', 'Review guide']),
    readingMinutes: z.number().int().positive(),
    order: z.number().int().positive(),
    featured: z.boolean().default(false),
    status: z.enum(['published', 'draft']).default('draft'),
  }),
});

export const collections = { blog };
