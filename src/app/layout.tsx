import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Otto Canvas",
  description: "AI design tool with infinite canvas — otto.design",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--canvas-bg)]">{children}</body>
    </html>
  );
}
