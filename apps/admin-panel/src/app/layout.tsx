import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IwootCall Admin",
  description: "Unified admin panel shell for IwootCall."
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
