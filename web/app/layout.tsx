import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "./lib/auth";

export const metadata: Metadata = {
  title: "Ameo",
  description: "Lightweight project management for small teams"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
