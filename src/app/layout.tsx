import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
const inter = Inter({subsets:['latin'],variable:'--font-sans'});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Phi Lab — Programming Hero Instructor Lab",
    template: "%s | Phi Lab",
  },
  description:
    "Interactive coding labs for beginner-to-advanced learners: a step-by-step JavaScript visualizer and an AI live voice technical interview.",
  openGraph: {
    title: "Phi Lab — Programming Hero Instructor Lab",
    description:
      "Interactive coding labs for beginner-to-advanced learners: a step-by-step JavaScript visualizer and an AI live voice technical interview.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", inter.variable, jetbrainsMono.variable)}  suppressHydrationWarning
    >
      <body className="bg-background text-foreground">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster/>
        </ThemeProvider>
      </body>
    </html>
  );
}
