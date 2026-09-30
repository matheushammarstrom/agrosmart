import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AgroSmart · Painel da lavoura",
  description: "Sanidade das folhas de batata e risco climático por talhão. FIAP Grupo 5.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
