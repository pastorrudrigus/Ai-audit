/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@aigate/core", "@aigate/db", "@aigate/verify"],
};

module.exports = nextConfig;
