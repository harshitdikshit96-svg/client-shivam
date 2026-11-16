// 1. Home
import Link from "next/link";
import Icon from "@/components/site/Icon";
import { Btn, CompanyGrid, CtaBand, IconCards, Section, Ticks } from "@/components/site/parts";
import { HOME, VERTICALS } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <section className="hp-hero">
        <div className="hp-wrap hp-hero-grid">
          <div>
            <h1>Building Businesses. <em>Creating Opportunities.</em></h1>
            {HOME.intro.map((t) => <p key={t} className="hp-lead">{t}</p>)}
            <p className="hp-mission-line"><b>Our Mission:</b> {HOME.mission}</p>
            <div className="hp-ctas">
              <Btn href="/companies">Explore Our Companies</Btn>
              <Btn href="/partners" kind="line" arrow={false}>Partner With Us</Btn>
              <Btn href="/contact" kind="line" arrow={false}>Contact Us</Btn>
            </div>
          </div>
          <div className="hp-collage">
            <div className="hp-frame" aria-hidden="true" />
            <figure className="hp-shot hp-s1"><img className="hp-cover" src="/home/hero-security.webp" alt="Security officer on duty" width="900" height="1200" fetchPriority="high" /><span className="hp-tag">Security &amp; Manpower</span></figure>
            <figure className="hp-shot hp-s2"><img className="hp-cover" src="/home/hero-infra.webp" alt="Engineers on a large construction site" width="900" height="900" /><span className="hp-tag">Infrastructure</span></figure>
            <figure className="hp-shot hp-s3"><img className="hp-cover" src="/home/hero-organic.webp" alt="Farm fields at sunrise" width="1000" height="691" /><span className="hp-tag">Organic &amp; Sustainable</span></figure>
          </div>
        </div>
      </section>

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

