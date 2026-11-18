import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoBreaker QA - Voice AI Adversarial Red-Team Harness",
  description:
    "Automated Voice AI Quality Assurance (QA) and Adversarial Stress-Testing Harness powered by Bolna, Wispr Flow, and OpenRouter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
