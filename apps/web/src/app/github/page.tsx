"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export default function GitHubPage() {
  const [token, setToken] = useState("");
  const queryClient = useQueryClient();

  const profilesQuery = useQuery(trpc.listGithubProfiles.queryOptions());

  const createMutation = useMutation({
    ...trpc.githubProfile.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.listGithubProfiles.queryOptions().queryKey });
    },
  });

  const updateMutation = useMutation({
    ...trpc.updateGithubProfile.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.listGithubProfiles.queryOptions().queryKey });
    },
  });

  const deleteMutation = useMutation({
    ...trpc.deleteGithubProfile.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.listGithubProfiles.queryOptions().queryKey });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ token });
  };

  const handleUpdate = (id: number) => {
    if (!token) {
      alert("请先输入 Token 再更新");
      return;
    }
    updateMutation.mutate({ id, token });
  };

  const handleDelete = (id: number) => {
    if (!confirm("确认删除这条记录？")) return;
    deleteMutation.mutate({ id });
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
          disabled={!token || createMutation.isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {createMutation.isPending ? "Loading..." : "获取 GitHub 信息"}
        </button>
      </form>

      {createMutation.error && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {createMutation.error.message}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">已保存的 Profiles</h2>

        {profilesQuery.isLoading && (
          <p className="text-sm text-muted-foreground">加载中...</p>
        )}

        {profilesQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无记录</p>
        )}

        <div className="space-y-4">
          {profilesQuery.data?.map((profile) => (
            <div key={profile.id} className="rounded-lg border p-4">
              <div className="flex items-center gap-4">
                {profile.avatarUrl && (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.login}
                    className="h-16 w-16 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {profile.name ?? profile.login}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    @{profile.login}
                  </p>
                </div>
              </div>

              {profile.bio && (
                <p className="mt-3 text-sm">{profile.bio}</p>
              )}

              <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                <span>Public repos: {profile.publicRepos}</span>
                {profile.githubCreatedAt && (
                  <span>
                    Joined: {new Date(profile.githubCreatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleUpdate(profile.id)}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {updateMutation.isPending ? "更新中..." : "更新"}
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center justify-center rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
