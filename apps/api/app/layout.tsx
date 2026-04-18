import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube DJ Prep API",
  description: "Next.js App Router API for the YouTube DJ prep pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
