import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { BRAND } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} - Real Estate CRM`, template: `%s | ${BRAND.name}` },
  description: BRAND.tagline,
  ...(BRAND.website ? { metadataBase: new URL(BRAND.website) } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </body>
    </html>
  );
}
