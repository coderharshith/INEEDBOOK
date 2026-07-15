/**
 * Root Layout
 *
 * Wraps all pages with the global HTML structure, metadata, font loading,
 * and the main content container. Loads the Inter font from Google Fonts.
 */

import type { Metadata } from "next";
import "./globals.css";

/** Global metadata for the application */
export const metadata: Metadata = {
  title: "INEEDBOOK",
  description: "Search and preview books instantly",
};

/**
 * Root layout component — renders the HTML shell with font preloading
 * and a <main> container for page content.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
