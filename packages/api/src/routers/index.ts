import { z } from "zod";
import { publicProcedure, router } from "../index";
import { db } from "@better-t-stack-app/db";
import { githubProfiles } from "@better-t-stack-app/db/schema";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),

  githubProfile: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${input.token}`,
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
      const profile = {
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        publicRepos: user.public_repos,
        githubCreatedAt: new Date(user.created_at),
      };

      await db.insert(githubProfiles).values(profile);

      return {
        ...profile,
        githubCreatedAt: user.created_at,
      };
    }),
});
export type AppRouter = typeof appRouter;