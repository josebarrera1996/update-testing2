import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["lh3.googleusercontent.com"],
    // Alternativamente, puedes usar remotePatterns para mayor seguridad
    // remotePatterns: [
    //   {
    //     protocol: 'https',
    //     hostname: 'lh3.googleusercontent.com',
    //     pathname: '/**',
    //   },
    // ],
  },
};

export default nextConfig;
