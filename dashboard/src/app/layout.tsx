import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AgroSmart · Inspeções de folhas",
  description: "Resultados das inspeções de folhas de batata por fazenda e talhão. FIAP Grupo 5.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
