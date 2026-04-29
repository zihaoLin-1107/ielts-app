import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "./RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS Vocab",
  description: "Low-friction IELTS vocabulary training PWA",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#4f7661",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
