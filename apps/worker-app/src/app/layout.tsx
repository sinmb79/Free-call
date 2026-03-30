import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IwootCall Worker",
  description: "Unified worker app shell for IwootCall modules."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
