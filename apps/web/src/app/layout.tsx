import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ads Agent — Agency Console",
  description:
    "AI-powered Google Ads research, creative, and campaign assembly for agencies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
