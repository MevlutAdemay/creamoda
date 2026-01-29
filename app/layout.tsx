import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ColorThemeProvider } from "@/components/shared/color-theme-provider";
import { ToastProvider } from '@/components/ui/ToastCenter';
import { ArtCard } from "@/components/ui/art-card";
import { HubProvider } from "@/components/hub/HubProvider";
import { HubButton } from "@/components/hub/HubButton";
import { HubOverlay } from "@/components/hub/HubOverlay";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Creamoda",
  description: "Moda Endüstrisi Simülasyon Oyunu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} antialiased`}
      >
        {/* Global Art Background */}
        <ArtCard />

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeProvider>
            <ToastProvider>
              <HubProvider>
                {/* Hub navigation components */}
                <HubButton />
                <HubOverlay />
                
                {children}
              </HubProvider>
            </ToastProvider>
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
