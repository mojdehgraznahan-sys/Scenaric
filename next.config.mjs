/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // This repo lives under ~/Documents, which macOS's privacy protections (TCC) wall
    // off from unentitled processes — webpack's filesystem cache does broad directory
    // stats to snapshot dependencies, which intermittently trips that restriction
    // ("Unable to snapshot resolve dependencies"). Non-fatal — the build still
    // succeeds — but switching the dev cache to memory avoids the failing disk
    // snapshot path entirely instead of just tolerating the warning every run.
    if (dev) {
      config.cache = Object.freeze({ type: "memory" });
    }
    return config;
  },
};

export default nextConfig;
