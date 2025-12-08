import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { ComicPages, ComicPanels, ComicProjects, and, db, eq } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(ComicProjects)
    .where(and(eq(ComicProjects.id, projectId), eq(ComicProjects.userId, userId)));

  if (!project) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Project not found.",
    });
  }

  return project;
}

async function getOwnedPage(pageId: string, projectId: string, userId: string) {
  await getOwnedProject(projectId, userId);

  const [page] = await db
    .select()
    .from(ComicPages)
    .where(and(eq(ComicPages.id, pageId), eq(ComicPages.projectId, projectId)));

  if (!page) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Page not found.",
    });
  }

  return page;
}

export const server = {
  createProject: defineAction({
    input: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      genre: z.string().optional(),
      format: z.string().optional(),
      targetAudience: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [project] = await db
        .insert(ComicProjects)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          title: input.title,
          description: input.description,
          genre: input.genre,
          format: input.format,
          targetAudience: input.targetAudience,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { project } };
    },
  }),

  updateProject: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        genre: z.string().optional(),
        format: z.string().optional(),
        targetAudience: z.string().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.description !== undefined ||
          input.genre !== undefined ||
          input.format !== undefined ||
          input.targetAudience !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedProject(input.id, user.id);

      const [project] = await db
        .update(ComicProjects)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.genre !== undefined ? { genre: input.genre } : {}),
          ...(input.format !== undefined ? { format: input.format } : {}),
          ...(input.targetAudience !== undefined ? { targetAudience: input.targetAudience } : {}),
          updatedAt: new Date(),
        })
        .where(eq(ComicProjects.id, input.id))
        .returning();

      return { success: true, data: { project } };
    },
  }),

  listProjects: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const projects = await db
        .select()
        .from(ComicProjects)
        .where(eq(ComicProjects.userId, user.id));

      return { success: true, data: { items: projects, total: projects.length } };
    },
  }),

  createPage: defineAction({
    input: z.object({
      projectId: z.string().min(1),
      pageNumber: z.number().int().min(1),
      title: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedProject(input.projectId, user.id);

      const now = new Date();
      const [page] = await db
        .insert(ComicPages)
        .values({
          id: crypto.randomUUID(),
          projectId: input.projectId,
          pageNumber: input.pageNumber,
          title: input.title,
          thumbnailUrl: input.thumbnailUrl,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { page } };
    },
  }),

  updatePage: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        projectId: z.string().min(1),
        pageNumber: z.number().int().min(1).optional(),
        title: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        notes: z.string().optional(),
      })
      .refine(
        (input) =>
          input.pageNumber !== undefined ||
          input.title !== undefined ||
          input.thumbnailUrl !== undefined ||
          input.notes !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPage(input.id, input.projectId, user.id);

      const [page] = await db
        .update(ComicPages)
        .set({
          ...(input.pageNumber !== undefined ? { pageNumber: input.pageNumber } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(ComicPages.id, input.id))
        .returning();

      return { success: true, data: { page } };
    },
  }),

  deletePage: defineAction({
    input: z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPage(input.id, input.projectId, user.id);

      await db.delete(ComicPages).where(eq(ComicPages.id, input.id));
      await db.delete(ComicPanels).where(eq(ComicPanels.pageId, input.id));

      return { success: true };
    },
  }),

  listPages: defineAction({
    input: z.object({
      projectId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedProject(input.projectId, user.id);

      const pages = await db
        .select()
        .from(ComicPages)
        .where(eq(ComicPages.projectId, input.projectId));

      return { success: true, data: { items: pages, total: pages.length } };
    },
  }),

  createPanel: defineAction({
    input: z.object({
      pageId: z.string().min(1),
      projectId: z.string().min(1),
      panelIndex: z.number().int(),
      layoutJson: z.string().optional(),
      description: z.string().optional(),
      dialogue: z.string().optional(),
      caption: z.string().optional(),
      soundEffects: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPage(input.pageId, input.projectId, user.id);

      const [panel] = await db
        .insert(ComicPanels)
        .values({
          id: crypto.randomUUID(),
          pageId: input.pageId,
          panelIndex: input.panelIndex,
          layoutJson: input.layoutJson,
          description: input.description,
          dialogue: input.dialogue,
          caption: input.caption,
          soundEffects: input.soundEffects,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { panel } };
    },
  }),

  updatePanel: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        pageId: z.string().min(1),
        projectId: z.string().min(1),
        panelIndex: z.number().int().optional(),
        layoutJson: z.string().optional(),
        description: z.string().optional(),
        dialogue: z.string().optional(),
        caption: z.string().optional(),
        soundEffects: z.string().optional(),
      })
      .refine(
        (input) =>
          input.panelIndex !== undefined ||
          input.layoutJson !== undefined ||
          input.description !== undefined ||
          input.dialogue !== undefined ||
          input.caption !== undefined ||
          input.soundEffects !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPage(input.pageId, input.projectId, user.id);

      const [existing] = await db
        .select()
        .from(ComicPanels)
        .where(eq(ComicPanels.id, input.id));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      const [panel] = await db
        .update(ComicPanels)
        .set({
          ...(input.panelIndex !== undefined ? { panelIndex: input.panelIndex } : {}),
          ...(input.layoutJson !== undefined ? { layoutJson: input.layoutJson } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.dialogue !== undefined ? { dialogue: input.dialogue } : {}),
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.soundEffects !== undefined ? { soundEffects: input.soundEffects } : {}),
        })
        .where(eq(ComicPanels.id, input.id))
        .returning();

      return { success: true, data: { panel } };
    },
  }),

  deletePanel: defineAction({
    input: z.object({
      id: z.string().min(1),
      pageId: z.string().min(1),
      projectId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPage(input.pageId, input.projectId, user.id);

      const result = await db.delete(ComicPanels).where(eq(ComicPanels.id, input.id));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      return { success: true };
    },
  }),

  listPanels: defineAction({
    input: z.object({
      pageId: z.string().min(1),
      projectId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPage(input.pageId, input.projectId, user.id);

      const panels = await db
        .select()
        .from(ComicPanels)
        .where(eq(ComicPanels.pageId, input.pageId));

      return { success: true, data: { items: panels, total: panels.length } };
    },
  }),
};
