import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * @loqal/contracts is published as raw TypeScript — its package exports map
   * "./*" straight at "./src/*.ts" with no build step, so the schemas the API
   * validates with and the schemas the dashboard parses with are the same file
   * rather than two copies that drift. Next has to be told to compile it;
   * without this the first `@loqal/contracts/...` import fails with
   * "Module parse failed: Unexpected token".
   */
  transpilePackages: ["@loqal/contracts"],

  /**
   * The design system is a read-only reference of hand-written HTML mockups.
   * It is not application source and must never be compiled or linted.
   */
  eslint: {
    dirs: ["src"],
  },
};

export default nextConfig;
