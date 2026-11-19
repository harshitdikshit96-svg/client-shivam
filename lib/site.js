// The public website's content, word for word from the client's "Complete Website Content & Page Structure".
// Pages: app/(site)/…; layout and shared pieces: components/site/.

export const GROUP = "Shivanji Group of Companies";
export const EMAIL = "contact@shivanjigroup.in";
export const TAGLINE = "Building Businesses. Creating Opportunities.";
export const FOOTER_TEXT = "A diversified business portfolio spanning manpower, security, infrastructure, healthcare and wellness initiatives, startups, organic products and consumer businesses.";

// header navigation (Login is added after these)
export const NAV = [
  ["/about", "About Us"],
  ["/companies", "Our Companies"],
  ["/services", "Services"],
  ["/partners", "Partners"],
  ["/careers", "Careers"],
  ["/contact", "Contact Us"],
];
export const QUICK_LINKS = [
  ["/", "Home"], ["/about", "About Us"], ["/companies", "Our Companies"], ["/services", "Services"],
  ["/projects", "Projects"], ["/careers", "Careers"], ["/vendor-registration", "Vendor Registration"], ["/contact", "Contact Us"],
];
// pages not in Quick Links, so every page can be reached from the footer and the phone menu
export const MORE_LINKS = [
  ["/industries", "Industries We Serve"], ["/partners", "Clients & Business Partners"],
  ["/enquiry", "Business Enquiry & Partnerships"], ["/news", "News & Updates"],
];
export const LEGAL_LINKS = [["/privacy", "Privacy Policy"], ["/terms", "Terms & Conditions"], ["/disclaimer", "Disclaimer"]];

// ---------- 1. Home ----------
export const HOME = {
  intro: [
    "Welcome to Shivanji Group of Companies, a diversified business group bringing together enterprises across manpower and security services, infrastructure development, healthcare and wellness, startup initiatives, organic products and emerging consumer businesses.",
    "We believe in building dependable business relationships, creating employment opportunities and developing sustainable growth across the sectors we serve.",
  ],
  mission: "To build reliable businesses that deliver value, encourage innovation and contribute to economic development.",
  who: [
    "Shivanji Group of Companies brings together a portfolio of businesses with distinct identities and areas of operation. Through our group-wide vision, we aim to strengthen operational excellence, professional service delivery and long-term business partnerships.",
    "Our businesses operate across multiple sectors, enabling us to explore new opportunities, collaborate with organizations and respond to evolving market requirements.",
  ],
  why: [
    "Multiple business verticals under a common group identity.",
    "Dedicated business entities for different areas of operation.",
    "Focus on professional conduct and business relationships.",
    "Commitment to responsible growth and continuous improvement.",
    "Interest in long-term collaborations with clients, vendors and business partners.",
  ],
  companiesSub: "Meet the businesses operating under the Shivanji Group identity.",
  groupEntry: ["Shivanji Group of Companies", "Group identity and business coordination"],
  together: [
    "Are you looking for a business service provider, manpower partner, project collaborator or new business opportunity?",
    "We welcome enquiries from businesses, institutions, organizations, vendors and prospective partners.",
  ],
};

export const VERTICALS = [
  ["shieldCheck", "Security & Manpower", "Security support, manpower supply and workforce management services, subject to each firm’s registrations and service authorizations."],
  ["building", "Infrastructure & Project Development", "Infrastructure-related business activities, project execution and development opportunities."],
  ["heartPulse", "Healthcare & Wellness", "Healthcare, wellness and related business initiatives, according to the relevant company’s actual service portfolio."],
  ["bulb", "Startups & Business Development", "Support for new business initiatives, entrepreneurship and emerging commercial opportunities."],
  ["leaf", "Organic & Sustainable Products", "Organic agriculture-related products, sustainable business initiatives and related opportunities."],
  ["bag", "Consumer & Lifestyle Businesses", "Consumer-oriented products, services and new market development initiatives."],
];
// Home hero carousel: one photo per vertical (Unsplash, free licence), files public/home/slide-NAME-{960,1920}.webp
export const HERO_SLIDES = [
  { name: "group", label: GROUP, alt: "Glass office towers seen from below" },
  { name: "security", label: "Security & Manpower", alt: "Security officer watching over a gathering" },
  { name: "infra", label: "Infrastructure & Project Development", alt: "Tower cranes over a building site at dusk" },
  { name: "health", label: "Healthcare & Wellness", alt: "Nurse wheeling an incubator down a hospital corridor" },
  { name: "startups", label: "Startups & Business Development", alt: "Business team in discussion around a table" },
  { name: "organic", label: "Organic & Sustainable Products", alt: "Green farm field at sunset" },
];

// ---------- 2. About ----------
export const ABOUT = {
  intro: [
    "Shivanji Group of Companies is a diversified business group focused on developing and coordinating businesses across a range of sectors.",
    "Our approach is based on identifying opportunities, building professional teams, establishing dependable relationships and developing businesses with a long-term perspective.",
    "Each company within our portfolio has its own business identity and operational focus. Our group vision is to encourage growth, explore synergies between businesses and create opportunities for collaboration.",
  ],
  vision: "To develop a trusted and professionally managed business group with a growing presence across diverse industries.",
  mission: [
    "To deliver dependable services through our respective businesses.",
    "To build long-term relationships with clients and business partners.",
    "To encourage employment, entrepreneurship and innovation.",
    "To explore sustainable and commercially viable business opportunities.",
    "To promote responsible business practices and continuous improvement.",
  ],
  values: [
    ["shield", "Integrity", "Conducting business transparently and responsibly."],
    ["briefcase", "Professionalism", "Maintaining a disciplined and service-oriented approach."],
    ["target", "Commitment", "Working towards agreed objectives and client requirements."],
    ["bulb", "Innovation", "Exploring improved methods, technologies and business models."],
    ["people", "Collaboration", "Building productive relationships with clients, employees, vendors and partners."],
    ["growth", "Growth", "Pursuing sustainable expansion through planning and execution."],
  ],
  approach: "We believe that every business has a distinct purpose. Our approach is to understand the needs of the market, develop appropriate capabilities and build partnerships that support sustainable business growth.",
};

// ---------- 3. Our Companies ----------
// sections: [heading, paragraph] or [heading, [list items]]
export const COMPANIES = [
  {
    slug: "akhya-security-services", name: "Akhya Security Services", vertical: "Security & Manpower Services",
    img: "co-akhya", alt: "Security guard on duty in a corporate lobby",
    intro: "Akhya Security Services focuses on security-related services and manpower support opportunities for organizations requiring dependable workforce solutions.",
    sections: [
      ["Proposed Services", [
        "Security personnel deployment, where duly licensed.",
        "Manpower supply and workforce support.",
        "Workforce scheduling and deployment coordination.",
        "Attendance and shift coordination.",
        "Site-level workforce supervision.",
        "Client-specific manpower requirements.",
      ]],
      ["Our Approach", "We aim to support clients through appropriate personnel deployment, professional coordination and a structured approach to workforce requirements."],
    ],
    cta: "Enquire About Security & Manpower Services",
  },
  {
    slug: "vinyasa-infra-developers", name: "Vinyasa Infra Developers", vertical: "Infrastructure & Project Development",
    img: "co-vinyasa", alt: "Workers on a construction site seen from above",
    intro: "Vinyasa Infra Developers is positioned for infrastructure-related business opportunities, project development and execution activities in accordance with its actual business scope.",
    sections: [
      ["Proposed Service Areas", [
        "Infrastructure project opportunities.",
        "Project execution and coordination.",
        "Site operations and resource coordination.",
        "Vendor and contractor coordination.",
        "Project documentation and reporting.",
        "Institutional and commercial project opportunities.",
      ]],
      ["Project Capability", "Our approach emphasizes planning, coordination, resource management and delivery against defined project requirements."],
      ["Work With Us", "We welcome enquiries from organizations seeking project partners, eligible contractors and infrastructure-related service providers."],
    ],
    cta: "Discuss an Infrastructure Project",
  },
  {
    slug: "secure-eye-security-and-manpower-suppliers", name: "Secure Eye Security and Manpower Suppliers", vertical: "Security, Staffing & Workforce Solutions",
    img: "co-secureeye", alt: "Security officer in a high-visibility vest",
    intro: "Secure Eye Security and Manpower Suppliers is focused on security and manpower-related service opportunities for institutional, commercial and other eligible clients.",
    sections: [
      ["Proposed Services", [
        "Security staffing, subject to applicable licensing.",
        "Manpower sourcing and deployment.",
        "Workforce allocation and shift management.",
        "Attendance coordination and reporting.",
        "Site workforce supervision.",
        "Client-specific staffing solutions.",
      ]],
      ["Our Service Approach", "We aim to understand client requirements, coordinate suitable personnel and support organized workforce deployment."],
    ],
    cta: "Request a Manpower Proposal",
  },
  {
    slug: "shivanji-health-and-wealth", name: "Shivanji Health & Wealth Private Limited", vertical: "Health, Wellness & Wealth-Related Initiatives",
    img: "co-health", alt: "Person practising yoga at sunset",
    intro: "Shivanji Health & Wealth Private Limited is part of the group’s broader business portfolio, with a focus on developing opportunities in the health, wellness and wealth-related sectors according to its approved business activities.",
    sections: [
      ["Business Areas", [
        "Health and wellness-related initiatives.",
        "Wellness products and services, where authorized.",
        "Consumer health-related business opportunities.",
        "Wellness partnerships and distribution opportunities.",
        "Financial wellness education or related initiatives, where applicable.",
      ]],
      ["Our Objective", "To explore responsible business opportunities that support customer well-being and sustainable commercial growth."],
    ],
    cta: "Business & Partnership Enquiries",
  },
  {
    slug: "vk-startup", name: "VK Startup Private Limited", vertical: "Startups, Entrepreneurship & Business Development",
    img: "co-vkstartup", alt: "Team working together on laptops",
    intro: "VK Startup Private Limited is positioned to explore startup-oriented business initiatives, new ventures and commercial development opportunities.",
    sections: [
      ["Proposed Business Areas", [
        "New business venture development.",
        "Startup and entrepreneurship initiatives.",
        "Business planning and market research.",
        "Strategic business partnerships.",
        "Digital business initiatives.",
        "Business development and growth opportunities.",
      ]],
      ["Our Philosophy", "We believe that successful ventures begin with clear objectives, market understanding, practical execution and the right partnerships."],
    ],
    cta: "Explore a Business Partnership",
  },
  {
    slug: "eco-ann-organic", name: "Eco Ann Organic Private Limited", vertical: "Organic Products & Sustainable Business",
    img: "co-ecoann", alt: "Young crops growing in rich soil",
    intro: "Eco Ann Organic Private Limited is intended to develop business opportunities related to organic products, agriculture-linked activities and sustainable commerce.",
    sections: [
      ["Proposed Business Areas", [
        "Organic and agriculture-related products.",
        "Agricultural sourcing and supply opportunities.",
        "Sustainable product distribution.",
        "Farmer and supplier partnerships.",
        "B2B product supply.",
        "Development of sustainable product lines.",
      ]],
      ["Our Commitment", "We aim to explore responsible sourcing, quality-focused operations and sustainable business opportunities."],
    ],
    cta: "Organic Products & Supplier Enquiries",
  },
  {
    slug: "pink-rider", name: "Pink Rider Private Limited", vertical: "Consumer & Emerging Business Initiatives",
    img: "co-pinkrider", alt: "Clothing displayed in a retail store",
    intro: "Pink Rider Private Limited is part of the group’s emerging business portfolio, with scope to develop consumer-oriented products, services and market opportunities according to its actual business activities.",
    sections: [
      ["Potential Business Areas", [
        "Consumer product development.",
        "Retail and distribution opportunities.",
        "E-commerce and digital sales.",
        "Brand development and marketing.",
        "Dealer and distributor partnerships.",
        "New consumer-focused business initiatives.",
      ]],
      ["Our Objective", "To identify market opportunities and develop commercially viable products and services supported by suitable distribution and customer engagement."],
    ],
    cta: "Retail & Distribution Enquiries",
  },
  // added 19 Nov 2026 at the client's request; text written to match the other companies, for the client to confirm
  {
    slug: "shivanji-hr-solutions", name: "Shivanji HR Solutions Private Limited", vertical: "Human Resources, Recruitment & Staffing Solutions",
    img: "co-shivanjihr", alt: "Recruiter interviewing a candidate across an office desk",
    intro: "Shivanji HR Solutions Private Limited is focused on human resources, recruitment and staffing-related services for organizations seeking dependable people and organized workforce management, in accordance with its actual business scope.",
    sections: [
      ["Proposed Services", [
        "Recruitment and talent sourcing.",
        "Permanent, contract and temporary staffing.",
        "Candidate screening and onboarding support.",
        "Payroll and statutory compliance support, where applicable.",
        "HR documentation and policy support.",
        "Workforce planning and HR advisory.",
      ]],
      ["Our Approach", "We aim to understand each client’s workforce needs, identify suitable candidates and support clear, compliant and well-documented HR processes."],
      ["Work With Us", "We welcome enquiries from employers seeking HR support and from candidates looking for suitable opportunities."],
    ],
    cta: "Discuss Your HR & Staffing Needs",
  },
];
export const COMPANY_NAMES = COMPANIES.map((c) => c.name);

// ---------- 4. Services ----------
export const SERVICES = {
  intro: "Our group brings together businesses with different capabilities and sector-specific objectives. Clients can contact the relevant company to discuss their requirements.",
  items: [
    ["shieldCheck", "Security & Manpower Solutions", "Workforce sourcing, deployment coordination and security-related services through appropriately authorized entities."],
    ["building", "Infrastructure & Project Opportunities", "Infrastructure-related project coordination, development and execution opportunities, within the scope of the relevant firm."],
    ["heartPulse", "Healthcare & Wellness Initiatives", "Business opportunities involving health and wellness-related products or services, where legally permitted."],
    ["bulb", "Startup & Business Development", "Exploration of new ventures, market opportunities, strategic partnerships and business growth initiatives."],
    ["leaf", "Organic Products & Agricultural Commerce", "Organic and agriculture-linked product sourcing, supply and distribution opportunities."],
    ["bag", "Consumer Business & Distribution", "Consumer-oriented product development, brand building, retail and distribution opportunities."],
  ],
  important: "Services are provided by the relevant individual entity and are subject to its actual capabilities, registrations, licences and contractual terms. Not every service is offered by every group company.",
};

// ---------- 5. Industries ----------
export const INDUSTRIES = {
  intro: "Depending on the capabilities and authorizations of the relevant company, our business opportunities may include:",
  items: [
    ["government", "Government and public-sector organizations."],
    ["office", "Private-sector businesses."],
    ["bag", "Commercial establishments."],
    ["building", "Infrastructure and project-based organizations."],
    ["factory", "Industrial and institutional clients."],
    ["heartPulse", "Healthcare and wellness-related businesses."],
    ["leaf", "Agricultural suppliers and distributors."],
    ["truck", "Retailers, dealers and distribution partners."],
    ["bulb", "Entrepreneurs and emerging businesses."],
  ],
  outro: "We encourage prospective clients to contact us with their specific requirements so that enquiries can be directed to the appropriate entity.",
};

// ---------- 6. Projects ----------
export const PROJECTS = {
  intro: [
    "We believe in demonstrating business capabilities through verifiable work, documented performance and relevant experience.",
    "This section will showcase selected projects undertaken by our individual companies.",
  ],
  categories: [
    ["people", "Manpower and workforce deployment."],
    ["shieldCheck", "Security services."],
    ["building", "Infrastructure-related projects."],
    ["heartPulse", "Healthcare and wellness initiatives."],
    ["leaf", "Organic product sourcing and distribution."],
    ["bulb", "Startup and consumer business development."],
  ],
};

// ---------- 7. Clients & Partners ----------
export const PARTNERS = {
  intro: [
    "We value professional relationships with organizations, suppliers, vendors and business partners.",
    "Our objective is to develop mutually beneficial collaborations based on clear expectations, professional communication and responsible business practices.",
  ],
  welcome: [
    "Corporate and institutional clients.",
    "Eligible government and public-sector procurement opportunities.",
    "Vendors and suppliers.",
    "Contractors and service providers.",
    "Distributors and channel partners.",
    "Entrepreneurs and business collaborators.",
  ],
};

// ---------- 8. Careers ----------
export const CAREERS = {
  intro: [
    "At Shivanji Group of Companies, we are interested in connecting with individuals who value professionalism, responsibility, teamwork and continuous learning.",
    "Employment opportunities, when available, may arise across the group’s different business verticals.",
  ],
  areas: [
    "Operations and administration.",
    "Human resources and workforce coordination.",
    "Site supervision.",
    "Business development and sales.",
    "Accounts and documentation.",
    "Project coordination.",
    "Digital operations and support.",
  ],
  apply: "Candidates can submit their details and preferred role for consideration against suitable openings.",
  note: "An application does not guarantee employment.",
};

// ---------- 11. News ----------
export const NEWS = {
  intro: "Stay informed about verified developments across our businesses.",
  features: [
    "New business initiatives.",
    "Project milestones.",
    "Product launches.",
    "Business partnerships.",
    "Recruitment announcements.",
    "Company events.",
    "Official notices and updates.",
  ],
};

// ---------- 13–15. Legal ----------
export const PRIVACY = [
  "Shivanji Group of Companies respects the privacy of visitors and individuals who contact us through our website.",
  "Information submitted through enquiry, recruitment or vendor-registration forms may be used to respond to requests, assess business enquiries, communicate relevant opportunities and maintain necessary business records.",
  "We aim to collect only information relevant to the stated purpose and to apply reasonable safeguards to protect it.",
  "Personal information may be shared with the relevant group entity or authorized service provider where necessary to process the enquiry or deliver the requested service, subject to applicable law.",
  "Website users should avoid submitting passwords, banking credentials or unnecessary sensitive personal information through general enquiry forms.",
];
export const TERMS = [
  "The information on this website is intended for general business and informational purposes.",
  "Descriptions of companies and services do not constitute a guarantee of availability, acceptance of a project or commitment to enter into a contract.",
  "Specific services, prices, delivery timelines and obligations will be governed by separate written agreements where applicable.",
  "Company names, logos, photographs, trademarks and other materials must not be used without appropriate authorization.",
  "Visitors must not use the website for unlawful activities, fraudulent submissions or unauthorized access attempts.",
  "We may update website content from time to time. Applicable laws and contractual agreements will govern matters requiring formal legal interpretation.",
];
export const DISCLAIMER = [
  "The website represents the business portfolio of Shivanji Group of Companies and its associated business entities, as accurately identified in the relevant sections.",
  "Each company may be a separate legal entity with its own registrations, management, responsibilities and service scope. Inclusion on this website does not by itself establish that one company legally owns, controls, guarantees or assumes the liabilities of another.",
  "All licences, certifications, registrations, project credentials and performance claims are subject to verification.",
  "No statement on this website should be interpreted as a promise of financial returns, guaranteed employment, guaranteed project awards or guaranteed business outcomes.",
];

// ---------- forms: fields and checks are in lib/site-forms.js ----------
