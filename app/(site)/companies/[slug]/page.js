// 3.1–3.7 One company
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/site/Icon";
import { Btn, PageHero, Ticks } from "@/components/site/parts";
import { COMPANIES } from "@/lib/site";

const find = (slug) => COMPANIES.find((c) => c.slug === slug);

export function generateStaticParams() {
  return COMPANIES.map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({ params }) {
  const c = find((await params).slug);
  return c ? { title: c.name, description: c.intro } : {};
}

export default async function CompanyPage({ params }) {
  const c = find((await params).slug);
  if (!c) notFound();
  const enquire = `/enquiry?company=${encodeURIComponent(c.name)}`;
  return (
    <>
      <PageHero trail={[["/companies", "Our Companies"], [`/companies/${c.slug}`, c.name]]} title={c.name}>
        <p className="hp-plead"><b>Business Vertical:</b> {c.vertical}</p>
      </PageHero>
      <section className="hp-sec hp-white">
        <div className="hp-wrap hp-split">
          <div>
            <p className="hp-body hp-body-lg">{c.intro}</p>
            <div className="hp-ctas"><Btn href={enquire}>{c.cta}</Btn></div>
          </div>
          <figure className="hp-pic"><img className="hp-cover" src={`/home/${c.img}.webp`} alt={c.alt} width="800" height="533" /></figure>
        </div>
      </section>
      <section className="hp-sec hp-ivory">
        <div className="hp-wrap hp-co-grid">
          {c.sections.map(([title, body]) => (
            <div key={title} className={`hp-panel ${Array.isArray(body) ? "hp-panel-wide" : ""}`}>
              <h2 className="hp-h3">{title}</h2>
              {Array.isArray(body) ? <Ticks items={body} cols /> : <p className="hp-body">{body}</p>}
            </div>
          ))}
        </div>
      </section>
      <section className="hp-sec hp-co-end">
        <div className="hp-wrap">
          <div className="hp-ctas hp-center-row"><Btn href={enquire}>{c.cta}</Btn></div>
          <h2 className="hp-h3">Our Companies</h2>
          <nav className="hp-co-others" aria-label="Our other companies">
            {COMPANIES.filter((o) => o.slug !== c.slug).map((o) => (
              <Link key={o.slug} href={`/companies/${o.slug}`}>{o.name}<Icon name="arrowRight" /></Link>
            ))}
          </nav>
        </div>
      </section>
    </>
  );
}
