import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Orbit Design System type: Newsreader (editorial serif — anything personal),
// Hanken Grotesk (humanist sans — UI and body), Spline Sans Mono (timestamps
// and tabular meta). Same families the design project self-hosts.
// next/font emits the semantic variable names directly — alias layers in
// CSS get stripped by the build (custom props referencing unknown vars).
const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-meta",
  subsets: ["latin"],
  weight: ["400", "500"],
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
