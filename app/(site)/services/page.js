// 4. Services
import Link from "next/link";
import Icon from "@/components/site/Icon";
import { Btn, IconCards, Note, PageHero, Section } from "@/components/site/parts";
import { SERVICES } from "@/lib/site";

export const metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <>
      <PageHero trail={[["/services", "Services"]]} title="Business Services Across Our Group" lead={SERVICES.intro} />
      <Section>
        <IconCards items={SERVICES.items} />
        <Note title="Important:">{SERVICES.important}</Note>
        <div className="hp-after">
          <Btn href="/contact">Contact Us</Btn>
          <Link href="/industries" className="hp-link">Industries We Serve<Icon name="arrowRight" /></Link>
        </div>
      </Section>
    </>
  );
}
