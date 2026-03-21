import { defineConfig } from "tsdown";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

function copyDirSync(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  entry: ["./src/index.ts", "./src/migrate.ts"],
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/^(?!node:).*/],
  hooks: {
    "build:done": () => {
      const migrationsDir = resolve("../../packages/db/src/migrations");

      if (!existsSync(migrationsDir)) {
        throw new Error(
          `迁移目录不存在: ${migrationsDir}\n请先运行 pnpm --filter db db:generate 生成迁移文件`,
        );
      }

      if (!existsSync(join(migrationsDir, "meta", "_journal.json"))) {
        throw new Error(
          `迁移目录缺少 meta/_journal.json，迁移文件不完整\n请运行 pnpm --filter db db:generate 重新生成`,
        );
      }

      const dest = "./dist/migrations";
      copyDirSync(migrationsDir, dest);

      const sqlFiles = readdirSync(dest).filter((f) => f.endsWith(".sql"));
      if (sqlFiles.length === 0) {
        throw new Error("迁移目录中没有 SQL 文件，部署后迁移将无法执行");
      }

      console.log(`✔ 已复制 ${sqlFiles.length} 个迁移文件到 dist/migrations`);
    },
  },
});
