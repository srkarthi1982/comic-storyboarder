/**
 * Comic Storyboarder - plan comic pages and panels visually.
 *
 * Design goals:
 * - Projects (series/one-shots) -> Pages -> Panels.
 * - Panels store layout position + text (dialogue, captions, SFX).
 * - Future drawing layers can be mapped via simple JSON.
 */

import { defineTable, column, NOW } from "astro:db";

export const ComicProjects = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),                               // series/issue/one-shot name
    description: column.text({ optional: true }),
    genre: column.text({ optional: true }),
    format: column.text({ optional: true }),            // "webtoon", "page-comic", etc.
    targetAudience: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ComicPages = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    projectId: column.text({
      references: () => ComicProjects.columns.id,
    }),
    pageNumber: column.number(),                        // 1, 2, 3...
    title: column.text({ optional: true }),
    thumbnailUrl: column.text({ optional: true }),      // optional preview image
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ComicPanels = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    pageId: column.text({
      references: () => ComicPages.columns.id,
    }),
    panelIndex: column.number(),                        // order on the page
    layoutJson: column.text({ optional: true }),        // panel position/size as JSON
    description: column.text({ optional: true }),       // what happens overall
    dialogue: column.text({ optional: true }),          // character speech
    caption: column.text({ optional: true }),           // narration text
    soundEffects: column.text({ optional: true }),      // "SFX: BOOM!"
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  ComicProjects,
  ComicPages,
  ComicPanels,
} as const;
