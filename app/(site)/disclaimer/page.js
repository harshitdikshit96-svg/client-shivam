// 15. Disclaimer
import { PageHero, Section } from "@/components/site/parts";
import { DISCLAIMER } from "@/lib/site";

export const metadata = { title: "Disclaimer" };

export default function Page() {
  return (
    <>
      <PageHero trail={[["/disclaimer", "Disclaimer"]]} title="Disclaimer" />
      <Section narrow>
        <div className="hp-prose">
          {DISCLAIMER.map((t) => <p key={t}>{t}</p>)}
          
        </div>
      </Section>
    </>
  );
}
