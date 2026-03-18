import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const githubProfiles = pgTable("github_profiles", {
  id: serial("id").primaryKey(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  publicRepos: integer("public_repos"),
  githubCreatedAt: timestamp("github_created_at"),
  insertedAt: timestamp("inserted_at").defaultNow().notNull(),
});