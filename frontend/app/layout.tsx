import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "@/components/HeaderWrapper";
import { WalletContextProvider } from "@/components/wallet-provider";
import LenisProvider from "@/components/lenis-provider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solcircle",
  description: "AI-driven Investment Strategies on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{zoom: '100%'}}>
      <body className={geistMono.variable}>
        <WalletContextProvider>
          <LenisProvider>
            <HeaderWrapper />
            {children}
          </LenisProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
