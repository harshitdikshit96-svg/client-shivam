// Building blocks shared by the website's pages.
import Link from "next/link";
import Icon from "./Icon";
import { COMPANIES, HOME } from "@/lib/site";

export function Brand() {
  return (
    <Link href="/" className="hp-brand" aria-label="Shivanji Group of Companies, home">
      <span className="hp-mono" aria-hidden="true">SG</span>
      <span className="hp-wm"><b>SHIVANJI GROUP</b><small>OF COMPANIES</small></span>
    </Link>
  );
}

/** Top band of every page except Home: where you are, the page title, an optional lead line. */
export function PageHero({ trail, title, lead, children }) {
  return (
    <section className="hp-phero">
      <div className="hp-wrap">
        <nav className="hp-trail" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          {trail?.map(([href, label]) => <span key={href}><span aria-hidden="true">/</span><Link href={href}>{label}</Link></span>)}
        </nav>
        <h1>{title}</h1>
        {lead && <p className="hp-plead">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

/** A section with a heading row: title on the left, optional text on the right. */
export function Section({ id, title, sub, tone, children, narrow }) {
  return (
    <section className={`hp-sec ${tone ? `hp-${tone}` : ""}`} id={id}>
      <div className={`hp-wrap ${narrow ? "hp-narrow" : ""}`}>
        {title && (
          <div className="hp-sec-head">
            <h2 className="hp-h2">{title}</h2>
            {sub && <p className="hp-sub">{sub}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Bullet list with gold ticks. */
export function Ticks({ items, cols }) {
  return (
    <ul className={`hp-ticks ${cols ? "hp-ticks-2" : ""}`}>
      {items.map((t) => <li key={t}><span className="hp-check"><Icon name="check" /></span>{t}</li>)}
    </ul>
  );
}

/** Cards with an icon, a title and text. */
export function IconCards({ items }) {
  return (
    <div className="hp-vgrid">
      {items.map(([icon, title, text], i) => (
        <article key={title} className="hp-vcard">
          <span className="hp-num">{String(i + 1).padStart(2, "0")}</span>
          <Icon name={icon} />
          <h3>{title}</h3>
          {text && <p>{text}</p>}
          <span className="hp-rule" />
        </article>
      ))}
    </div>
  );
}

export function Btn({ href, kind = "navy", children, arrow = true }) {
  return <Link href={href} className={`hp-btn hp-btn-${kind}`}>{children}{arrow && <Icon name="arrowUp" />}</Link>;
}

/** Closing navy band with a heading, text and buttons. */
export function CtaBand({ title, text, children }) {
  return (
    <section className="hp-closing">
      <img src="/home/cta-city.webp" alt="" width="1920" height="1056" loading="lazy" />
      <div className="hp-wrap">
        <h2>{title}</h2>
        {(Array.isArray(text) ? text : [text]).filter(Boolean).map((t) => <p key={t}>{t}</p>)}
        <div className="hp-ctas">{children}</div>
      </div>
    </section>
  );
}

/** Pale box for an important statement. */
export function Note({ title, children }) {
  return <div className="hp-notebox">{title && <b>{title}</b>} {children}</div>;
}

/** The seven companies, then the group itself. Also used on /companies. */
export function CompanyGrid() {
  return (
    <div className="hp-cgrid">
      {COMPANIES.map((c, i) => (
        <Link key={c.slug} href={`/companies/${c.slug}`} className="hp-ccard">
          <figure><img className="hp-cover" src={`/home/${c.img}.webp`} alt={c.alt} width="800" height="533" loading="lazy" /></figure>
          <div className="hp-cbody">
            <span className="hp-pill">{i + 1}. {c.vertical}</span>
            <h3>{c.name}</h3>
            <span className="hp-link">View company<Icon name="arrowRight" /></span>
          </div>
        </Link>
      ))}
      <Link href="/about" className="hp-cnote">
        <span className="hp-mono" aria-hidden="true">SG</span>
        <div>
          <span className="hp-pill">8. {HOME.groupEntry[1]}</span>
          <h3>{HOME.groupEntry[0]}</h3>
        </div>
        <span className="hp-link">About Us<Icon name="arrowRight" /></span>
      </Link>
    </div>
  );
}
