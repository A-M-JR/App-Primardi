/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
