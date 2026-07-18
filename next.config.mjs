/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server for slim container images.
  output: "standalone",
  // packages/* holds framework-agnostic modules imported via tsconfig paths.
  // Next compiles them as part of the app; no extra config needed for that,
  // but we keep server-only deps (prisma) external to the client bundle.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
