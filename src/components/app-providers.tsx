"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={250}>
      {children}
      <Toaster theme="dark" position="bottom-center" />
    </TooltipProvider>
  );
}
