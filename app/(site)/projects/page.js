// 6. Projects & Work Portfolio
import Icon from "@/components/site/Icon";
import { PageHero, Section } from "@/components/site/parts";
import { PROJECTS } from "@/lib/site";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <PageHero trail={[["/projects", "Projects"]]} title="Our Projects">
        {PROJECTS.intro.map((t) => <p key={t} className="hp-plead">{t}</p>)}
      </PageHero>
      <Section title="Project Categories">
        <div className="hp-sectors hp-sectors-3">
          {PROJECTS.categories.map(([icon, label]) => <div key={label} className="hp-sector"><Icon name={icon} />{label}</div>)}
        </div>
      </Section>
    </>
  );
}
