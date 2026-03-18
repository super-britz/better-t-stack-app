import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../index";
import { db } from "@better-t-stack-app/db";
import { githubProfiles } from "@better-t-stack-app/db/schema";

async function fetchGithubUser(token: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${error}`);
  }

  const user = (await res.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    public_repos: number;
    created_at: string;
  };

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    publicRepos: user.public_repos,
    githubCreatedAt: new Date(user.created_at),
  };
}

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),

  listGithubProfiles: publicProcedure.query(async () => {
    return db.select().from(githubProfiles);
  }),

  githubProfile: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const profile = await fetchGithubUser(input.token);
      const [inserted] = await db
        .insert(githubProfiles)
        .values(profile)
        .returning();
      return inserted;
    }),

  updateGithubProfile: publicProcedure
    .input(z.object({ id: z.number(), token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const profile = await fetchGithubUser(input.token);
      const [updated] = await db
        .update(githubProfiles)
        .set(profile)
        .where(eq(githubProfiles.id, input.id))
        .returning();
      if (!updated) {
        throw new Error("Profile not found");
      }
      return updated;
    }),

  deleteGithubProfile: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .delete(githubProfiles)
        .where(eq(githubProfiles.id, input.id))
        .returning();
      if (!deleted) {
        throw new Error("Profile not found");
      }
      return deleted;
    }),
});
export type AppRouter = typeof appRouter;