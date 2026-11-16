// 8. Careers
import SiteForm from "@/components/site/SiteForm";
import { PageHero, Section, Ticks } from "@/components/site/parts";
import { CAREERS, FORMS } from "@/lib/site";

export const metadata = { title: "Careers" };

export default function CareersPage() {
  return (
    <>
      <PageHero trail={[["/careers", "Careers"]]} title="Build Your Career With Us">
        {CAREERS.intro.map((t) => <p key={t} className="hp-plead">{t}</p>)}
      </PageHero>
      <Section title="Potential Opportunity Areas" tone="ivory">
        <Ticks items={CAREERS.areas} cols />
      </Section>
      <Section title="Apply for an Opportunity" sub={CAREERS.apply}>
        <SiteForm fields={FORMS.careers} submit="Submit Your Resume" label="Apply for an Opportunity" />
        <p className="hp-small-note">{CAREERS.note}</p>
      </Section>
    </>
  );
}
