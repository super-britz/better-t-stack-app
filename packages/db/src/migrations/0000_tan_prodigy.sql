CREATE TABLE "github_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"bio" text,
	"public_repos" integer,
	"github_created_at" timestamp,
	"inserted_at" timestamp DEFAULT now() NOT NULL
);
