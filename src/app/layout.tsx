import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sadhana Reiki Rounds",
  description: "Guided breathing and meditation rounds with session storage",
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
