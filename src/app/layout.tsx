/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";
import "@radix-ui/themes/styles.css";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Operations Workspace",
  description: "School operations workspace for admissions, store, inventory and communication.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "School Operations"
  },
  icons: {
    icon: "/api/pwa/icon?size=64",
    shortcut: "/api/pwa/icon?size=64",
    apple: "/api/pwa/icon?size=180"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
