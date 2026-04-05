import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIGate — Plataforma Unificada de IA Corporativa",
  description: "Gateway, gestão e visibilidade de toda a IA da sua empresa em um só lugar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body>
          {children}
          <Toaster richColors position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
