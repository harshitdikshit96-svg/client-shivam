import "./globals.css";

export const metadata = { title: "Contractor Portal", robots: { index: false, follow: false } };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
