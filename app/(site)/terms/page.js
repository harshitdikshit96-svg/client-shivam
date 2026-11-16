// 14. Terms & Conditions
import { PageHero, Section } from "@/components/site/parts";
import { TERMS, EMAIL } from "@/lib/site";

export const metadata = { title: "Terms & Conditions" };

export default function Page() {
  return (
    <>
      <PageHero trail={[["/terms", "Terms & Conditions"]]} title="Website Terms of Use" />
      <Section>
        <div className="hp-prose">
          {TERMS.map((t) => <p key={t}>{t}</p>)}
          <p>For enquiries regarding these terms, contact <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        </div>
      </Section>
    </>
  );
}
