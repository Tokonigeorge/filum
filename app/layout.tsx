import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "filum",
  description: "Local-first networked notes with an auto-generated knowledge graph",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistMono.variable} antialiased bg-[#080808] text-neutral-100`}
      >
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
