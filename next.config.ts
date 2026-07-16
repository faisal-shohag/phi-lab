import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Chromium is a 65MB brotli blob and a native binary. Bundling it the way the
  // tracer bundles JS would corrupt it; these two have to be required at runtime
  // from node_modules instead.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  // Pixel Lab renders learner CSS in a headless Chromium that has no system
  // fonts, so the sandbox ships its own face inlined as a data: URI. The server
  // opens the woff2 by path rather than importing it, so the tracer cannot find
  // it alone — without this, text renders as blank boxes in production only.
  outputFileTracingIncludes: {
    "/api/labs/pixel-lab/**": ["./public/pixel-lab/geist-latin.woff2"],
  },
};

export default nextConfig;
