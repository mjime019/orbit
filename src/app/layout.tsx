import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Orbit Design System type: Newsreader (editorial serif — anything personal),
// Hanken Grotesk (humanist sans — UI and body), Spline Sans Mono (timestamps
// and tabular meta). Same families the design project self-hosts.
// Self-hosted from ./fonts (latin, variable wght; OFL texts alongside) —
// next/font/google fetched them at build time, and a bad Google response
// failed a production build. No build-time network now.
// next/font emits the semantic variable names directly — alias layers in
// CSS get stripped by the build (custom props referencing unknown vars).
const newsreader = localFont({
  variable: "--font-display",
  src: [
    {
      path: "./fonts/newsreader/Newsreader-Variable-latin.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "./fonts/newsreader/Newsreader-Italic-Variable-latin.woff2",
      weight: "400 600",
      style: "italic",
    },
  ],
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const hanken = localFont({
  variable: "--font-body",
  src: "./fonts/hanken-grotesk/HankenGrotesk-Variable-latin.woff2",
  weight: "400 700",
  display: "swap",
});

const splineMono = localFont({
  variable: "--font-meta",
  src: "./fonts/spline-sans-mono/SplineSansMono-Variable-latin.woff2",
  weight: "400 500",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Orbit — Your Preschool Concierge",
  description:
    "A personalized control room for parents, powered by your child's real school observations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${hanken.variable} ${splineMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
