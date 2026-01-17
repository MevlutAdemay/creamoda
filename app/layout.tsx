import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ColorThemeProvider } from "@/components/shared/color-theme-provider";
import { ToastProvider } from '@/components/ui/ToastCenter';

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
