// Website footer (content section 16), plus the pages Quick Links leaves out.
import Link from "next/link";
import { Brand } from "./parts";
import { COMPANIES, FOOTER_TEXT, GROUP, LEGAL_LINKS, MORE_LINKS, QUICK_LINKS } from "@/lib/site";

const Column = ({ title, links }) => (
  <div>
    <h4>{title}</h4>
    <ul>{links.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
  </div>
);

export default function SiteFooter() {
  return (
    <footer className="hp-ft">
      <div className="hp-wrap">
        <div className="hp-ft-grid">
          <div>
            <Brand />
            <p className="hp-line">Building Businesses.<br /><em>Creating Opportunities.</em></p>
            <p className="hp-desc">{FOOTER_TEXT}</p>
          </div>
          <Column title="Quick Links" links={QUICK_LINKS} />
          <Column title="Our Companies" links={COMPANIES.map((c) => [`/companies/${c.slug}`, c.name])} />
          <div className="hp-ft-stack">
            <Column title="Legal" links={LEGAL_LINKS} />
            <Column title="More" links={MORE_LINKS} />
          </div>
        </div>
      </div>
      <div className="hp-ft-bar"><div className="hp-wrap">© {new Date().getFullYear()} {GROUP}. All rights reserved.</div></div>
    </footer>
  );
}
