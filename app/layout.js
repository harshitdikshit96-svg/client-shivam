import "./globals.css";

export const metadata = {
  title: { default: "Shivanji Group of Companies | Building Businesses. Creating Opportunities.", template: "%s | Shivanji Group of Companies" },
  description: "Shivanji Group of Companies is a diversified business group spanning manpower and security services, infrastructure development, healthcare and wellness, startups, organic products and consumer businesses.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
