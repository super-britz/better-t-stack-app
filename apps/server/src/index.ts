import { createContext } from "@better-t-stack-app/api/context";
import { appRouter } from "@better-t-stack-app/api/routers/index";
import { env } from "@better-t-stack-app/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

// Lambda 入口
export const handler = async (event: any, context: any) => {
  const { handle } = await import("hono/aws-lambda");
  return handle(app)(event, context);
};

// 本地开发
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const { serve } = await import("@hono/node-server");
  serve(
    { fetch: app.fetch, port: 3000 },
    (info) => console.log(`Server is running on http://localhost:${info.port}`),
  );
}
