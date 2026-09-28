import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import AppBackground from "./components/app-background";
import AppRail from "./components/app-rail";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Edgebook",
  description:
    "A personal forecasting desk for Polymarket markets, built on the Nansen API.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${barlow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg font-body text-text">
        <AppBackground />
        <div className="relative z-[1] min-h-full md:grid md:grid-cols-[248px_1fr]">
          <AppRail />
          <main className="min-w-0 pb-[104px] md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}


