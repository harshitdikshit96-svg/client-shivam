// 7. Clients & Business Partners
import { Btn, PageHero, Section, Ticks } from "@/components/site/parts";
import { PARTNERS } from "@/lib/site";

export const metadata = { title: "Clients & Business Partners" };

export default function PartnersPage() {
  return (
    <>
      <PageHero trail={[["/partners", "Clients & Business Partners"]]} title="Building Strong Business Relationships">
        {PARTNERS.intro.map((t) => <p key={t} className="hp-plead">{t}</p>)}
      </PageHero>
      <Section title="Partner With Us" sub="We welcome enquiries from:">
        <Ticks items={PARTNERS.welcome} cols />
        <div className="hp-after"><Btn href="/enquiry">Become a Business Partner</Btn></div>
      </Section>
    </>
  );
}
