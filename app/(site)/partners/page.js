// 7. Clients & Business Partners, plus the partners entered in the portal (Website → Partners, CR-16)
import { Btn, PageHero, Section, Ticks } from "@/components/site/parts";
import { PARTNERS } from "@/lib/site";
import { getDb } from "@/db/index";
import { partnerRows } from "@/lib/data";

export const metadata = { title: "Clients & Business Partners" };
export const dynamic = "force-dynamic";   // a partner saved in the portal shows at once

const rupees = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

async function loadPartners() {
  try {
    return await partnerRows(await getDb());
  } catch (e) {
    console.error("/partners: could not read partners", e);   // the page still shows its fixed content
    return [];
  }
}

export default async function PartnersPage() {
  const list = await loadPartners();
  return (
    <>
      <PageHero trail={[["/partners", "Clients & Business Partners"]]} title="Building Strong Business Relationships">
        {PARTNERS.intro.map((t) => <p key={t} className="hp-plead">{t}</p>)}
      </PageHero>
      {list.length > 0 && (
        <Section title="Our Partners" tone="ivory">
          <div className="hp-pgrid">
            {list.map((p) => (
              <article key={p.id} className="hp-ptile">
                <div className="hp-plogo">
                  {p.logo ? <img src={p.logo} alt={`${p.name} logo`} loading="lazy" /> : <span aria-hidden="true">{p.name.slice(0, 2).toUpperCase()}</span>}
                </div>
                <h3>{p.name}</h3>
                {p.description && <p>{p.description}</p>}
                {p.cost != null && <p className="hp-pcost"><span>Cost</span>{rupees(p.cost)}</p>}
              </article>
            ))}
          </div>
        </Section>
      )}
      <Section title="Partner With Us" sub="We welcome enquiries from:">
        <Ticks items={PARTNERS.welcome} cols />
        <div className="hp-after"><Btn href="/enquiry">Become a Business Partner</Btn></div>
      </Section>
    </>
  );
}
