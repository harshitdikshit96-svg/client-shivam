// 1. Home
import Link from "next/link";
import Icon from "@/components/site/Icon";
import HeroCarousel from "@/components/site/HeroCarousel";
import { Btn, CompanyGrid, CtaBand, IconCards, Section, Ticks } from "@/components/site/parts";
import { HOME, VERTICALS } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <HeroCarousel>
        <span className="hp-hero-rule" aria-hidden="true" />
        <h1>Building Businesses. <em>Creating Opportunities.</em></h1>
        {HOME.intro.map((t) => <p key={t} className="hp-lead">{t}</p>)}
        <p className="hp-mission-line"><b>Our Mission:</b> {HOME.mission}</p>
        <div className="hp-ctas">
          <Btn href="/companies" kind="gold">Explore Our Companies</Btn>
          <Btn href="/partners" kind="ghost" arrow={false}>Partner With Us</Btn>
          <Btn href="/contact" kind="ghost" arrow={false}>Contact Us</Btn>
        </div>
      </HeroCarousel>

      <section className="hp-sec hp-white">
        <div className="hp-wrap hp-split">
          <div>
            <h2 className="hp-h2">Who We Are</h2>
            {HOME.who.map((t) => <p key={t} className="hp-body">{t}</p>)}
            <Link href="/about" className="hp-link">About Us<Icon name="arrowRight" /></Link>
          </div>
          <figure className="hp-pic"><img className="hp-cover" src="/home/who-team.webp" alt="Team in discussion around a meeting table" width="1300" height="1021" loading="lazy" /></figure>
        </div>
      </section>

      <Section title="Our Business Verticals" tone="ivory">
        <IconCards items={VERTICALS} />
        <div className="hp-after"><Btn href="/services" kind="line">Services</Btn></div>
      </Section>

      <section className="hp-sec hp-dark">
        <div className="hp-wrap hp-why">
          <h2 className="hp-h2">Why Choose Shivanji Group?</h2>
          <Ticks items={HOME.why} />
        </div>
      </section>

      <Section title="Our Companies" sub={HOME.companiesSub}>
        <CompanyGrid />
      </Section>

      <CtaBand title="Let’s Build Something Together" text={HOME.together}>
        <Btn href="/enquiry" kind="gold">Start a Business Enquiry</Btn>
      </CtaBand>
    </>
  );
}

