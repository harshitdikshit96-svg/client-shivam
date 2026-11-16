// 3. Our Companies
import { CompanyGrid, PageHero, Section } from "@/components/site/parts";
import { HOME } from "@/lib/site";

export const metadata = { title: "Our Companies" };

export default function CompaniesPage() {
  return (
    <>
      <PageHero trail={[["/companies", "Our Companies"]]} title="Our Companies" lead={HOME.companiesSub} />
      <Section><CompanyGrid /></Section>
    </>
  );
}
