// 10. Business Enquiry & Partnerships
import SiteForm from "@/components/site/SiteForm";
import { PageHero, Section } from "@/components/site/parts";
import { FORMS } from "@/lib/site";

export const metadata = { title: "Business Enquiry & Partnerships" };

export default function EnquiryPage() {
  return (
    <>
      <PageHero trail={[["/enquiry", "Business Enquiry & Partnerships"]]} title="Let’s Explore New Opportunities"
        lead="Whether you are looking for a service provider, a business collaboration or a distribution partner, we invite you to share your requirements." />
      <Section title="Enquiry Form">
        <SiteForm fields={FORMS.enquiry} submit="Submit Enquiry" label="Enquiry form" />
        <p className="hp-small-note">Our team can review the enquiry and direct it to the relevant company, subject to availability and suitability.</p>
      </Section>
    </>
  );
}
