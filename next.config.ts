import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // GramJS (the server's Telegram login, src/lib/chatwatch) opens raw TCP
  // connections and loads Node built-ins at runtime: run it as plain Node,
  // not bundled.
  serverExternalPackages: ["telegram"],
};

export default withNextIntl(nextConfig);
