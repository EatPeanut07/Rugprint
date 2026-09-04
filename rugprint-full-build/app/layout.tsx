import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RugPrint — Follow the footprint",
  description: "Evidence-first Solana creator and wallet relationship intelligence."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
