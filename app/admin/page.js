import App from "@/components/App";
export const dynamic = "force-dynamic";
// The ERP portal: its login, then everything else. Kept out of search engines.
export const metadata = { title: "Client Portal", robots: { index: false, follow: false } };
export default function Page() {
  return <App />;
}
