// 12. Contact Us
import Link from "next/link";
import Icon from "@/components/site/Icon";
import SiteForm from "@/components/site/SiteForm";
import { PageHero, Section } from "@/components/site/parts";
import { COMPANIES, EMAIL, FORMS, GROUP } from "@/lib/site";

export const metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <>
      <PageHero trail={[["/contact", "Contact Us"]]} title="Get in Touch With Shivanji Group of Companies"
        lead="For business enquiries, partnerships, vendor registration and general information, please contact us through the details below." />
      <Section>
        <div className="hp-contact">
          <aside>
            <dl className="hp-dl">
              <dt>Group Name</dt><dd>{GROUP}</dd>
              <dt>Email</dt><dd><a href={`mailto:${EMAIL}`} className="hp-mail"><Icon name="mail" />{EMAIL}</a></dd>
            </dl>
            <h2 className="hp-h3">Company-Specific Enquiries</h2>
            <p className="hp-body">Please select the company relevant to your requirement:</p>
            <ol className="hp-olist">
              {COMPANIES.map((c) => <li key={c.slug}><Link href={`/companies/${c.slug}`}>{c.name}</Link></li>)}
            </ol>
          </aside>
          <div>
            <h2 className="hp-h3">Contact Form</h2>
            <SiteForm fields={FORMS.contact} submit="Send an Enquiry" label="Contact form" />
          </div>
        </div>
      </Section>
    </>
  );
}
