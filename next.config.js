/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better error handling
  reactStrictMode: true,

  // Configure hostname for Docker
  // Next.js 13+ automatically binds to 0.0.0.0 when using -H flag

  // SWC minification is enabled by default in Next.js 13+
  // No need to specify swcMinify anymore

  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript errors during builds (optional)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable experimental features if needed
  experimental: {
    // Add experimental features here if needed
  },

  // Configure headers for security and iframe embedding
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // Allow iframe embedding from any origin
          // X-Frame-Options removed to enable iframe rendering
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *"
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
