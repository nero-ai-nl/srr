import type { Metadata } from "next";
import "./globals.css";

const faviconPath = process.env.NEXT_PUBLIC_FAVICON_PATH?.trim() || "/favicon-prod.svg";

export const metadata: Metadata = {
  title: "Sadhana Reiki Rounds",
  description: "Guided breathing and meditation rounds with session storage",
  icons: {
    icon: faviconPath,
    shortcut: faviconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
