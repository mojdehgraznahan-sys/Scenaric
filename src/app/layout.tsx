import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Prototype favicon — the Scenaric quadrant mark (ink bg, one orange tile)
const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' rx='11' fill='%231E1B2E'/><rect x='9' y='9' width='12' height='12' rx='3.5' fill='%23fff'/><rect x='27' y='9' width='12' height='12' rx='3.5' fill='%23F97316'/><rect x='9' y='27' width='12' height='12' rx='3.5' fill='%23fff'/><rect x='27' y='27' width='12' height='12' rx='3.5' fill='%23fff'/></svg>";

export const metadata: Metadata = {
  title: "Scenaric — scenario planning",
  description: "AI-powered scenario planning platform",
  icons: { icon: FAVICON },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
