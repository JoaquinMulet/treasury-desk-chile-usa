import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TickerBar } from "@/components/layout/ticker-bar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Treasury Desk · Bonds",
  description: "Gestión táctica de tesorería corporativa — yields, curvas, oportunidades",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0 overflow-x-hidden">
              <TickerBar />
              <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
                <SidebarTrigger className="-ml-1 h-7 w-7" />
                <Separator orientation="vertical" className="mr-1 h-3" />
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Treasury Desk
                </div>
                <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-pos)] animate-pulse" />
                    LIVE
                  </span>
                </div>
              </header>
              <main className="min-w-0 flex-1 px-4 py-4">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
