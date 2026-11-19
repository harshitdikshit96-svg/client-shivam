// 9. Vendor Registration
import SiteForm from "@/components/site/SiteForm";
import { PageHero, Section } from "@/components/site/parts";

export const metadata = { title: "Vendor Registration" };

export default function VendorPage() {
  return (
    <>
      <PageHero trail={[["/vendor-registration", "Vendor Registration"]]} title="Register as a Vendor or Supplier"
        lead="We welcome eligible vendors and suppliers interested in working with our individual companies." />
      <Section title="Registration Details">
        <SiteForm form="vendor" submit="Register as a Vendor" label="Vendor registration" />
        <p className="hp-small-note">Vendor registration is subject to document verification, business requirements and the relevant company’s approval process.</p>
      </Section>
    </>
  );
}
