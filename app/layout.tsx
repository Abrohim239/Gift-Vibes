import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gift Vibes Business Manager",
  description: "Manage Gift Vibes orders, products, stock, expenses and profit."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
