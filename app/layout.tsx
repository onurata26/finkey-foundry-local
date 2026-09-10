import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./finkey-v2.css";
import "./rag-local.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const imageUrl = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "Finkey Local — Belgelerine sor",
    description:
      "Belgelerini cihazında indeksle, Foundry Local ile kaynaklı cevaplar ve doğrulanmış grafikler üret.",
    icons: {
      icon: "/favicon-transparent.png",
      shortcut: "/favicon-transparent.png",
    },
    openGraph: {
      title: "Finkey",
      description: "Belgelerine yerel yapay zekâyla sor; dosyaların bu cihazda kalsın.",
      type: "website",
      images: [{ url: imageUrl, width: 1672, height: 941, alt: "Finkey Local belge asistanı" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Finkey",
      description: "Belgelerine yerel yapay zekâyla sor; dosyaların bu cihazda kalsın.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
