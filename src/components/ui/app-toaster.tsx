"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      duration={5000}
      position="top-right"
      richColors
      theme="dark"
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
