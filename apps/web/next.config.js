/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@aigate/core", "@aigate/db"],
};

module.exports = nextConfig;
