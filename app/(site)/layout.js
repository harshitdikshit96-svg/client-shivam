// The public website: header, page, footer. The portal lives at /admin, outside this group.
import "../home.css";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

export default function SiteLayout({ children }) {
  return (
    <div className="hp" id="top">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
