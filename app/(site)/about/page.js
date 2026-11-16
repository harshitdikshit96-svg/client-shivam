// 2. About Us
import Icon from "@/components/site/Icon";
import { PageHero, Section, Ticks } from "@/components/site/parts";
import { ABOUT } from "@/lib/site";

export const metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <>
      <PageHero trail={[["/about", "About Us"]]} title="About Shivanji Group of Companies" />
      <section className="hp-sec hp-white">
        <div className="hp-wrap hp-split">
          <div>{ABOUT.intro.map((t) => <p key={t} className="hp-body">{t}</p>)}</div>
          <figure className="hp-pic"><img className="hp-cover" src="/home/who-team.webp" alt="Team in discussion around a meeting table" width="1300" height="1021" /></figure>
        </div>
      </section>
      <Section tone="ivory">
        <div className="hp-two">
          <div className="hp-panel hp-panel-navy">
            <h2 className="hp-h3">Our Vision</h2>
            <p className="hp-quote">{ABOUT.vision}</p>
          </div>
          <div className="hp-panel">
            <h2 className="hp-h3">Our Mission</h2>
            <Ticks items={ABOUT.mission} />
          </div>
        </div>
      </Section>
      <Section title="Our Core Values">
        <div className="hp-vgrid">
          {ABOUT.values.map(([icon, name, text]) => (
            <article key={name} className="hp-vcard">
              <Icon name={icon} />
              <h3>{name}</h3>
              <p>{text}</p>
              <span className="hp-rule" />
            </article>
          ))}
        </div>
      </Section>
      <section className="hp-sec hp-dark">
        <div className="hp-wrap hp-why">
          <h2 className="hp-h2">Our Approach</h2>
          <p className="hp-quote">{ABOUT.approach}</p>
        </div>
      </section>
    </>
  );
}
