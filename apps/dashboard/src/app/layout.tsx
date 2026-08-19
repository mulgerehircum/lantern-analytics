import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

export const metadata = {
  title: "Lantern Analytics",
  description: "Privacy-first web analytics",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: theme.color.bg, fontFamily: theme.font.family, color: theme.color.text }}>
        {children}
      </body>
    </html>
  );
}
