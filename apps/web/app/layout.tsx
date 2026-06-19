import type { Metadata } from "next";
import {
  Newsreader,
  Hanken_Grotesk,
  Space_Mono,
  Bricolage_Grotesque,
  Syne,
} from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

// Editorial display / serif — wordmark, headings, the italic preview line.
// (Variable fonts: omit explicit weights so the full axis range is available.)
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Body / sans
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

// Mono labels / timestamps (non-variable — explicit weights required)
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Logo wordmark
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// Auth headings / expressive accents
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LinerNotes",
  description:
    "The moment a song hits you, kept while you're still in it. A listening journal — now in beta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${hanken.variable} ${spaceMono.variable} ${bricolage.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
        {/* film-grain overlay (matches the design's mix-blend grain) */}
        <div className="ln-grain" aria-hidden />
      </body>
    </html>
  );
}
