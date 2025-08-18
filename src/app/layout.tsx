import type { Metadata } from "next";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: "Future Web",
  description: "AI 交易复盘与量化工具集",
};

export default function RootLayout(
  props: Readonly<{ children: React.ReactNode }>
) {
  const { children } = props;
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
