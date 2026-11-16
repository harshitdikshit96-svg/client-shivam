// 5. Industries We Serve
import Icon from "@/components/site/Icon";
import { Btn, PageHero, Section } from "@/components/site/parts";
import { INDUSTRIES } from "@/lib/site";

export const metadata = { title: "Industries We Serve" };

export default function IndustriesPage() {
  return (
    <>
      <PageHero trail={[["/industries", "Industries We Serve"]]} title="Industries We Serve" lead={INDUSTRIES.intro} />
      <Section>
        <div className="hp-sectors">
          {INDUSTRIES.items.map(([icon, label]) => <div key={label} className="hp-sector"><Icon name={icon} />{label}</div>)}
        </div>
        <p className="hp-body hp-centered">{INDUSTRIES.outro}</p>
        <div className="hp-after hp-center-row"><Btn href="/contact">Contact Us</Btn></div>
      </Section>
    </>
  );
}
