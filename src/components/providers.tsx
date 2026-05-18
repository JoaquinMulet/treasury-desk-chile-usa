"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={qc}>
        {children}
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
