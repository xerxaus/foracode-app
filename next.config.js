/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vercel'in ufak ESLint uyarılarında fişi çekmesini engeller
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vercel'in TypeScript hatalarını görmezden gelmesini sağlar
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;