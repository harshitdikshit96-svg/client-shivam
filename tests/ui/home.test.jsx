// The public website: content pages, Login in the navbar going to the portal at /admin.
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("not found"); } }));
const { default: SiteHeader } = await import("@/components/site/SiteHeader");
const { default: HomePage } = await import("@/app/(site)/page");
const { default: CompanyPage } = await import("@/app/(site)/companies/[slug]/page");
const { default: ContactPage } = await import("@/app/(site)/contact/page");
const { COMPANIES } = await import("@/lib/site");

describe("website", () => {
  it("Login in the navbar (and the phone menu) goes to /admin", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Login" })).toHaveAttribute("href", "/admin");
    const logins = screen.getAllByRole("link", { name: "Login", hidden: true });
    expect(logins.map((a) => a.getAttribute("href"))).toEqual(["/admin", "/admin"]);
  });

  it("home has the client's sections and buttons, and links every company to its own page", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Building Businesses. Creating Opportunities.");
    for (const h of ["Who We Are", "Our Business Verticals", "Why Choose Shivanji Group?", "Our Companies", "Let’s Build Something Together"]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
    const link = (name) => screen.getByRole("link", { name }).getAttribute("href");
    expect(link("Explore Our Companies")).toBe("/companies");
    expect(link("Partner With Us")).toBe("/partners");
    expect(link("Contact Us")).toBe("/contact");
    expect(link("Start a Business Enquiry")).toBe("/enquiry");
    for (const c of COMPANIES) expect(screen.getByRole("link", { name: new RegExp(c.name) })).toHaveAttribute("href", `/companies/${c.slug}`);
  });

  it("a company page has its own content and its enquiry button", async () => {
    render(await CompanyPage({ params: Promise.resolve({ slug: "vinyasa-infra-developers" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vinyasa Infra Developers");
    expect(screen.getByRole("heading", { name: "Project Capability" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Discuss an Infrastructure Project" })[0])
      .toHaveAttribute("href", "/enquiry?company=Vinyasa%20Infra%20Developers");
  });

  it("submitting a form shows the thank-you message", async () => {
    render(<ContactPage />);
    screen.getByRole("button", { name: "Send an Enquiry" }).click();
    expect(await screen.findByRole("status")).toHaveTextContent("Your details have been submitted successfully.");
    expect(screen.getAllByRole("link", { name: "secureeyelko@gmail.com" }).length).toBeGreaterThan(0);
  });
});

describe("website partners (CR-16)", () => {
  it("/partners shows the partners from the portal as tiles, and nothing extra when there are none", async () => {
    const data = await import("@/lib/data");
    const spy = vi.spyOn(data, "partnerRows");
    const { default: PartnersPage } = await import("@/app/(site)/partners/page");
    spy.mockResolvedValue([{ id: 1, name: "Acme Infra", description: "Site security.", cost: 125000, logo: "/api/partner-logo/1?v=1" }]);
    const { unmount } = render(await PartnersPage());
    expect(screen.getByRole("heading", { name: "Our Partners" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Acme Infra logo" })).toHaveAttribute("src", "/api/partner-logo/1?v=1");
    expect(screen.getByText("₹1,25,000")).toBeInTheDocument();
    unmount();
    spy.mockResolvedValue([]);
    render(await PartnersPage());
    expect(screen.queryByRole("heading", { name: "Our Partners" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Partner With Us" })).toBeInTheDocument();
  });
});
