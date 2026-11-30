import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 전용 SDK는 번들에 넣지 않는다
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
