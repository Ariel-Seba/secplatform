import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecPlatform",
  description: "Modular Security Operations Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="font-sans bg-sp-bg-primary text-sp-text antialiased">
        {children}
      </body>
    </html>
  );
}
