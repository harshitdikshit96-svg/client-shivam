// 11. News & Updates
import { PageHero, Section, Ticks } from "@/components/site/parts";
import { NEWS } from "@/lib/site";

export const metadata = { title: "News & Updates" };

export default function NewsPage() {
  return (
    <>
      <PageHero trail={[["/news", "News & Updates"]]} title="News, Announcements & Business Updates" lead={NEWS.intro} />
      <Section title="This section may feature:">
        <Ticks items={NEWS.features} cols />
      </Section>
    </>
  );
}
