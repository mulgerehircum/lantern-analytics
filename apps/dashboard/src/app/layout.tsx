import type { ReactNode } from "react";

export const metadata = {
  title: "Lantern Analytics",
  description: "Privacy-first web analytics",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
