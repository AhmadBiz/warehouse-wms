import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Warehouse OS", template: "%s · Warehouse OS" },
  description: "Where every pallet is, how much space is left, and where the next one goes.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f172a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 min-w-0 pb-20 md:pb-8">
            <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
