"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function GitHubPage() {
  const [token, setToken] = useState("");

  const profileMutation = useMutation(
    trpc.githubProfile.mutationOptions()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({ token });
  };

  return (
    <div className="container mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">GitHub Profile Lookup</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="token" className="text-sm font-medium">
            GitHub Personal Access Token
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={!token || profileMutation.isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {profileMutation.isPending ? "Loading..." : "获取 GitHub 信息"}
        </button>
      </form>

      {profileMutation.error && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {profileMutation.error.message}
        </div>
      )}

      {profileMutation.data && (
        <div className="mt-6 rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <img
              src={profileMutation.data.avatarUrl}
              alt={profileMutation.data.login}
              className="h-16 w-16 rounded-full"
            />
            <div>
              <h2 className="text-lg font-semibold">
                {profileMutation.data.name ?? profileMutation.data.login}
              </h2>
              <p className="text-sm text-muted-foreground">
                @{profileMutation.data.login}
              </p>
            </div>
          </div>

          {profileMutation.data.bio && (
            <p className="mt-3 text-sm">{profileMutation.data.bio}</p>
          )}

          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span>Public repos: {profileMutation.data.publicRepos}</span>
            <span>
              Joined: {new Date(profileMutation.data.githubCreatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
