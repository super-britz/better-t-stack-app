import "@better-t-stack-app/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
