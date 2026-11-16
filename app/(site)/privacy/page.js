// 13. Privacy Policy
import { PageHero, Section } from "@/components/site/parts";
import { PRIVACY, EMAIL } from "@/lib/site";

export const metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <>
      <PageHero trail={[["/privacy", "Privacy Policy"]]} title="Privacy Policy" />
      <Section>
        <div className="hp-prose">
          {PRIVACY.map((t) => <p key={t}>{t}</p>)}
          <p>For privacy-related questions, contact: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        </div>
      </Section>
    </>
  );
}
