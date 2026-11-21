import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "KaalBiz AI",
  description:
    "Tell your assistant what happened in your business. It organizes the information and helps you understand your business.",
};

export const viewport: Viewport = {
  themeColor: "#0e6b4c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={<div className="min-h-dvh bg-background" />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
