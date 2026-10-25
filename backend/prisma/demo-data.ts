/**
 * Reference pools for the demo-data generator.
 *
 * Kept separate from seed-demo.ts so the generator reads as logic and
 * this file reads as content. Everything here is fictional; the company
 * context (Oman/Gulf/India, B2B e-procurement) is chosen so the data
 * looks plausible rather than like obvious filler.
 */

// ---------------------------------------------------------------------
//  Organisation
// ---------------------------------------------------------------------

export const DEPARTMENTS = [
  { code: 'ENG', name: 'Engineering', description: 'Platform, product and infrastructure engineering' },
  { code: 'PRD', name: 'Product', description: 'Product management, research and design' },
  { code: 'QAE', name: 'Quality Assurance', description: 'Manual and automation testing' },
  { code: 'DAT', name: 'Data & Analytics', description: 'Data engineering, BI and data science' },
  { code: 'ITS', name: 'IT Support', description: 'Internal IT, service desk and endpoint management' },
  { code: 'SEC', name: 'Information Security', description: 'Security engineering, GRC and operations' },
  { code: 'SAL', name: 'Sales', description: 'Enterprise and mid-market revenue' },
  { code: 'MKT', name: 'Marketing', description: 'Brand, demand generation and content' },
  { code: 'CSU', name: 'Customer Success', description: 'Onboarding, support and account management' },
  { code: 'OPS', name: 'Operations', description: 'Business operations and service delivery' },
  { code: 'FIN', name: 'Finance', description: 'Finance, accounting, treasury and procurement' },
  { code: 'HR', name: 'Human Resources', description: 'People operations, talent and L&D' },
  { code: 'LEG', name: 'Legal & Compliance', description: 'Contracts, regulatory and compliance' },
  { code: 'PMO', name: 'Project Management', description: 'Delivery, programme and change management' },
];

export const LOCATIONS = [
  'Muscat, Oman',
  'Muscat, Oman',
  'Muscat, Oman',
  'Sohar, Oman',
  'Salalah, Oman',
  'Dubai, UAE',
  'Abu Dhabi, UAE',
  'Doha, Qatar',
  'Bengaluru, India',
  'Hyderabad, India',
  'Remote (GCC)',
];

export const SOURCES = [
  { name: 'Company Careers Page', category: 'DIRECT', weight: 26 },
  { name: 'LinkedIn', category: 'SOCIAL', weight: 24 },
  { name: 'Employee Referral', category: 'REFERRAL', weight: 14 },
  { name: 'Naukri Gulf', category: 'JOB_BOARD', weight: 11 },
  { name: 'Bayt.com', category: 'JOB_BOARD', weight: 8 },
  { name: 'Indeed', category: 'JOB_BOARD', weight: 6 },
  { name: 'Recruitment Agency', category: 'AGENCY', weight: 5 },
  { name: 'Campus Hiring', category: 'DIRECT', weight: 3 },
  { name: 'GitHub / Open Source', category: 'SOCIAL', weight: 2 },
  { name: 'Walk-in', category: 'DIRECT', weight: 1 },
];

// ---------------------------------------------------------------------
//  Skills, grouped so job postings pick a coherent stack
// ---------------------------------------------------------------------

export const SKILL_GROUPS: Record<string, string[]> = {
  Programming: ['TypeScript', 'JavaScript', 'Java', 'Python', 'C#', 'Go', 'Kotlin', 'PHP', 'Ruby', 'Rust', 'Scala', 'Swift'],
  Frontend: ['React', 'Next.js', 'Angular', 'Vue', 'Redux', 'TanStack Query', 'SCSS', 'Tailwind CSS', 'Webpack', 'Vite', 'Accessibility (WCAG)'],
  Backend: ['Node.js', 'NestJS', 'Express', 'Spring Boot', '.NET Core', 'Django', 'FastAPI', 'Laravel', 'GraphQL', 'REST API Design', 'gRPC', 'Microservices'],
  Database: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'SQL Server', 'Prisma', 'Elasticsearch', 'Database Tuning'],
  DevOps: ['Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'Helm', 'Prometheus', 'Grafana', 'Linux Administration', 'Nginx', 'Kong Gateway'],
  Cloud: ['AWS', 'Azure', 'Google Cloud', 'AWS Lambda', 'Azure DevOps', 'CloudFormation', 'Cloud Cost Optimisation'],
  Mobile: ['React Native', 'Flutter', 'Android (Kotlin)', 'iOS (Swift)'],
  Testing: ['Selenium', 'Cypress', 'Playwright', 'Jest', 'JUnit', 'Postman', 'JMeter', 'Test Automation', 'Manual Testing', 'API Testing'],
  Data: ['SQL', 'Power BI', 'Tableau', 'Apache Spark', 'Airflow', 'dbt', 'Snowflake', 'ETL', 'Data Modelling', 'Pandas', 'Machine Learning', 'TensorFlow'],
  Security: ['Penetration Testing', 'OWASP Top 10', 'SIEM', 'ISO 27001', 'Incident Response', 'Vulnerability Management', 'IAM', 'Network Security', 'Cryptography'],
  Business: ['Product Management', 'Agile', 'Scrum', 'JIRA', 'Confluence', 'Stakeholder Management', 'Roadmapping', 'Business Analysis', 'Requirements Gathering', 'PRINCE2', 'PMP'],
  Design: ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Design Systems', 'Adobe XD'],
  Sales: ['B2B Sales', 'Enterprise Sales', 'Salesforce CRM', 'Lead Generation', 'Negotiation', 'Account Management', 'Solution Selling', 'Tendering'],
  Marketing: ['SEO', 'Content Marketing', 'Google Analytics', 'HubSpot', 'Email Marketing', 'Social Media Strategy', 'Brand Management', 'Campaign Management'],
  Finance: ['IFRS', 'Financial Reporting', 'Budgeting & Forecasting', 'SAP FICO', 'Accounts Payable', 'Audit', 'Treasury', 'Cost Accounting', 'Tally'],
  HR: ['Recruitment', 'Talent Acquisition', 'Employee Relations', 'Payroll', 'HRIS', 'Learning & Development', 'Omanisation Compliance', 'Performance Management'],
  Support: ['Active Directory', 'Microsoft 365', 'ITIL', 'Service Desk', 'Hardware Troubleshooting', 'Networking (CCNA)', 'VMware'],
  SoftSkills: ['Communication', 'Leadership', 'Problem Solving', 'Team Collaboration', 'Mentoring', 'Presentation Skills', 'Arabic (Business)', 'English (Fluent)'],
};

// ---------------------------------------------------------------------
//  Job templates
//
//  Each produces a realistic requisition: a coherent skill stack, a
//  sensible seniority band and a salary range in OMR-equivalent USD.
// ---------------------------------------------------------------------

export interface JobTemplate {
  title: string;
  designation: string;
  department: string;
  minExp: number;
  maxExp: number;
  salaryMin: number;
  salaryMax: number;
  required: string[];
  preferred: string[];
  summary: string;
  responsibilities: string[];
  qualifications: string[];
}

export const JOB_TEMPLATES: JobTemplate[] = [
  // ---------------- Engineering ----------------
  {
    title: 'Senior Backend Engineer',
    designation: 'Senior Software Engineer',
    department: 'ENG',
    minExp: 5, maxExp: 9, salaryMin: 42000, salaryMax: 62000,
    required: ['Node.js', 'TypeScript', 'NestJS', 'MySQL', 'REST API Design'],
    preferred: ['Docker', 'Kubernetes', 'Redis', 'Microservices'],
    summary: 'Design and build the services that power our B2B procurement platform, used daily by hundreds of buying organisations and thousands of suppliers.',
    responsibilities: [
      'Design, build and operate backend services handling high-volume transactional workloads',
      'Own features end to end, from technical design through to production support',
      'Write clear, well-tested code and participate in code review',
      'Work with product and QA to turn requirements into shippable increments',
      'Improve observability, performance and reliability of services you own',
    ],
    qualifications: [
      "Bachelor's degree in Computer Science, Software Engineering or equivalent experience",
      '5+ years building production backend services',
      'Strong grounding in relational data modelling and SQL',
      'Experience with API design and versioning in a multi-team environment',
    ],
  },
  {
    title: 'Frontend Engineer (React)',
    designation: 'Software Engineer',
    department: 'ENG',
    minExp: 3, maxExp: 6, salaryMin: 34000, salaryMax: 50000,
    required: ['React', 'TypeScript', 'SCSS', 'REST API Design'],
    preferred: ['TanStack Query', 'Accessibility (WCAG)', 'Vite', 'Tailwind CSS'],
    summary: 'Build the interfaces our customers use to run tenders, manage suppliers and approve purchases.',
    responsibilities: [
      'Build accessible, responsive interfaces against documented APIs',
      'Collaborate closely with design on component behaviour and states',
      'Maintain and extend our shared component library',
      'Write component and end-to-end tests for the flows you ship',
    ],
    qualifications: [
      '3+ years building production React applications with TypeScript',
      'Solid understanding of browser fundamentals and performance',
      'Familiarity with accessibility standards',
    ],
  },
  {
    title: 'Full Stack Engineer',
    designation: 'Software Engineer',
    department: 'ENG',
    minExp: 4, maxExp: 8, salaryMin: 38000, salaryMax: 56000,
    required: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    preferred: ['GraphQL', 'AWS', 'Docker'],
    summary: 'Work across the stack on customer-facing product squads, shipping features from database to browser.',
    responsibilities: [
      'Deliver features across frontend and backend within a product squad',
      'Participate in technical design discussions and architecture reviews',
      'Support and improve what you ship after release',
    ],
    qualifications: ['4+ years full stack development', 'Comfortable owning a feature end to end'],
  },
  {
    title: 'Lead Software Engineer',
    designation: 'Engineering Lead',
    department: 'ENG',
    minExp: 8, maxExp: 14, salaryMin: 62000, salaryMax: 88000,
    required: ['Java', 'Spring Boot', 'Microservices', 'Leadership', 'Mentoring'],
    preferred: ['Kubernetes', 'Kafka' as string, 'AWS', 'Database Tuning'],
    summary: 'Lead a squad of engineers building core platform capability, balancing hands-on delivery with technical direction.',
    responsibilities: [
      'Set technical direction for a squad of 5–7 engineers',
      'Remain hands-on: roughly 50% of your time is writing and reviewing code',
      'Grow engineers through mentoring, feedback and well-pitched work',
      'Partner with product on scope, sequencing and trade-offs',
    ],
    qualifications: [
      '8+ years engineering experience, including 2+ leading a team',
      'Track record delivering distributed systems at scale',
    ],
  },
  {
    title: 'DevOps Engineer',
    designation: 'DevOps Engineer',
    department: 'ENG',
    minExp: 4, maxExp: 8, salaryMin: 40000, salaryMax: 60000,
    required: ['Docker', 'Kubernetes', 'Terraform', 'Linux Administration', 'GitHub Actions'],
    preferred: ['AWS', 'Prometheus', 'Grafana', 'Helm', 'Kong Gateway'],
    summary: 'Own the platform our engineers deploy onto: pipelines, infrastructure as code, and the observability that keeps it honest.',
    responsibilities: [
      'Build and maintain CI/CD pipelines and deployment tooling',
      'Manage infrastructure as code across environments',
      'Own monitoring, alerting and incident response tooling',
      'Harden the platform and reduce toil through automation',
    ],
    qualifications: ['4+ years in DevOps/SRE', 'Strong Linux and container fundamentals'],
  },
  {
    title: 'Cloud Infrastructure Engineer',
    designation: 'Infrastructure Engineer',
    department: 'ENG',
    minExp: 5, maxExp: 10, salaryMin: 45000, salaryMax: 68000,
    required: ['AWS', 'Terraform', 'Linux Administration', 'Networking (CCNA)'],
    preferred: ['Azure', 'Kubernetes', 'Cloud Cost Optimisation', 'Ansible'],
    summary: 'Design and run the cloud foundations the whole business depends on.',
    responsibilities: [
      'Design resilient, cost-effective cloud architecture',
      'Automate provisioning and configuration',
      'Lead capacity planning and disaster-recovery exercises',
    ],
    qualifications: ['5+ years cloud infrastructure', 'Relevant cloud certification preferred'],
  },
  {
    title: 'Mobile Engineer (React Native)',
    designation: 'Software Engineer',
    department: 'ENG',
    minExp: 3, maxExp: 7, salaryMin: 36000, salaryMax: 54000,
    required: ['React Native', 'TypeScript', 'REST API Design'],
    preferred: ['Android (Kotlin)', 'iOS (Swift)', 'Redux'],
    summary: 'Build and ship the mobile experience for buyers and suppliers on the move.',
    responsibilities: ['Develop and release cross-platform mobile features', 'Own app performance, crash rates and store releases'],
    qualifications: ['3+ years mobile development', 'Published apps on the App Store or Play Store'],
  },
  {
    title: 'Software Engineer (Graduate)',
    designation: 'Associate Software Engineer',
    department: 'ENG',
    minExp: 0, maxExp: 2, salaryMin: 18000, salaryMax: 26000,
    required: ['JavaScript', 'SQL', 'Problem Solving'],
    preferred: ['React', 'Node.js', 'Git' as string],
    summary: 'A structured graduate route into professional software engineering, with mentoring and a clear development plan.',
    responsibilities: [
      'Work on well-scoped tasks with support from a senior engineer',
      'Learn our codebase, tooling and engineering practices',
      'Contribute to code review and team ceremonies',
    ],
    qualifications: ["Bachelor's degree in a computing discipline", 'Demonstrable personal or academic projects'],
  },

  // ---------------- QA ----------------
  {
    title: 'QA Automation Engineer',
    designation: 'QA Engineer',
    department: 'QAE',
    minExp: 3, maxExp: 7, salaryMin: 32000, salaryMax: 48000,
    required: ['Test Automation', 'Playwright', 'TypeScript', 'API Testing'],
    preferred: ['Cypress', 'Jenkins', 'JMeter', 'Postman'],
    summary: 'Build the automated safety net that lets us release weekly with confidence.',
    responsibilities: [
      'Design and maintain automated regression suites',
      'Integrate test execution into CI pipelines',
      'Partner with engineers on testability and quality at source',
    ],
    qualifications: ['3+ years test automation', 'Strong scripting ability'],
  },
  {
    title: 'Senior QA Engineer',
    designation: 'Senior QA Engineer',
    department: 'QAE',
    minExp: 5, maxExp: 9, salaryMin: 38000, salaryMax: 54000,
    required: ['Manual Testing', 'Test Automation', 'API Testing', 'Selenium'],
    preferred: ['Performance Testing' as string, 'JMeter', 'Mentoring'],
    summary: 'Own quality strategy for a product area and raise the bar across the team.',
    responsibilities: ['Define test strategy for your product area', 'Mentor junior QA engineers', 'Drive defect prevention, not just detection'],
    qualifications: ['5+ years QA across manual and automated testing'],
  },

  // ---------------- Data ----------------
  {
    title: 'Data Engineer',
    designation: 'Data Engineer',
    department: 'DAT',
    minExp: 4, maxExp: 8, salaryMin: 40000, salaryMax: 60000,
    required: ['Python', 'SQL', 'ETL', 'Airflow', 'Data Modelling'],
    preferred: ['Apache Spark', 'dbt', 'Snowflake', 'AWS'],
    summary: 'Build the pipelines that turn raw platform events into data the business can actually use.',
    responsibilities: [
      'Build and operate batch and streaming data pipelines',
      'Model data for analytics and reporting consumption',
      'Own data quality, lineage and pipeline reliability',
    ],
    qualifications: ['4+ years data engineering', 'Strong SQL and Python'],
  },
  {
    title: 'Business Intelligence Analyst',
    designation: 'BI Analyst',
    department: 'DAT',
    minExp: 3, maxExp: 6, salaryMin: 30000, salaryMax: 46000,
    required: ['SQL', 'Power BI', 'Data Modelling', 'Stakeholder Management'],
    preferred: ['Tableau', 'Python', 'dbt'],
    summary: 'Turn questions from across the business into dashboards and analysis people act on.',
    responsibilities: ['Build and maintain dashboards', 'Partner with teams to define metrics that mean something', 'Run ad-hoc analysis'],
    qualifications: ['3+ years BI/analytics', 'Excellent SQL'],
  },
  {
    title: 'Data Scientist',
    designation: 'Data Scientist',
    department: 'DAT',
    minExp: 4, maxExp: 9, salaryMin: 45000, salaryMax: 68000,
    required: ['Python', 'Machine Learning', 'SQL', 'Pandas'],
    preferred: ['TensorFlow', 'Apache Spark', 'Snowflake'],
    summary: 'Apply statistical and machine-learning methods to supplier matching, spend analysis and demand forecasting.',
    responsibilities: ['Frame business problems as analytical ones', 'Build, validate and ship models', 'Communicate findings and their limits clearly'],
    qualifications: ["Master's or Bachelor's in a quantitative field", '4+ years applied data science'],
  },

  // ---------------- Security ----------------
  {
    title: 'Information Security Engineer',
    designation: 'Security Engineer',
    department: 'SEC',
    minExp: 4, maxExp: 9, salaryMin: 44000, salaryMax: 66000,
    required: ['OWASP Top 10', 'Vulnerability Management', 'SIEM', 'Network Security'],
    preferred: ['Penetration Testing', 'ISO 27001', 'IAM', 'Incident Response'],
    summary: 'Protect a platform that carries commercially sensitive procurement data for major regional organisations.',
    responsibilities: [
      'Run vulnerability management and coordinate remediation',
      'Review architecture and code for security risk',
      'Support incident response and post-incident review',
      'Contribute to ISO 27001 evidence and audit readiness',
    ],
    qualifications: ['4+ years in information security', 'Relevant certification (CISSP, OSCP, CEH) preferred'],
  },
  {
    title: 'GRC Analyst',
    designation: 'Compliance Analyst',
    department: 'SEC',
    minExp: 3, maxExp: 7, salaryMin: 34000, salaryMax: 50000,
    required: ['ISO 27001', 'Audit', 'Communication'],
    preferred: ['Incident Response', 'Business Analysis'],
    summary: 'Keep our governance, risk and compliance posture demonstrable rather than theoretical.',
    responsibilities: ['Maintain the control framework and its evidence', 'Coordinate internal and external audits', 'Run the risk register'],
    qualifications: ['3+ years in GRC or audit'],
  },

  // ---------------- Product & Design ----------------
  {
    title: 'Senior Product Manager',
    designation: 'Senior Product Manager',
    department: 'PRD',
    minExp: 6, maxExp: 12, salaryMin: 52000, salaryMax: 78000,
    required: ['Product Management', 'Roadmapping', 'Stakeholder Management', 'Agile'],
    preferred: ['Business Analysis', 'JIRA', 'SQL'],
    summary: 'Own a core product area end to end: the problem, the strategy, and the outcomes.',
    responsibilities: [
      'Own strategy and roadmap for your product area',
      'Talk to customers regularly and turn what you learn into decisions',
      'Work with engineering and design to ship, measure and iterate',
    ],
    qualifications: ['6+ years product management in B2B SaaS', 'Evidence of outcomes, not just output'],
  },
  {
    title: 'Product Designer (UX/UI)',
    designation: 'Product Designer',
    department: 'PRD',
    minExp: 3, maxExp: 7, salaryMin: 32000, salaryMax: 50000,
    required: ['Figma', 'UX Research', 'UI Design', 'Prototyping'],
    preferred: ['Design Systems', 'Accessibility (WCAG)', 'Adobe XD'],
    summary: 'Design workflows that make complex procurement processes feel straightforward.',
    responsibilities: ['Own design for features from discovery to delivery', 'Run research and usability testing', 'Extend our design system'],
    qualifications: ['3+ years product design', 'Portfolio showing process, not just screens'],
  },
  {
    title: 'Business Analyst',
    designation: 'Business Analyst',
    department: 'PRD',
    minExp: 3, maxExp: 7, salaryMin: 30000, salaryMax: 46000,
    required: ['Business Analysis', 'Requirements Gathering', 'Stakeholder Management', 'JIRA'],
    preferred: ['SQL', 'Agile', 'Confluence'],
    summary: 'Bridge business need and technical delivery on enterprise implementations.',
    responsibilities: ['Elicit and document requirements', 'Map current and future-state processes', 'Support UAT and rollout'],
    qualifications: ['3+ years business analysis', 'Strong documentation and facilitation skills'],
  },

  // ---------------- PMO ----------------
  {
    title: 'Project Manager',
    designation: 'Project Manager',
    department: 'PMO',
    minExp: 5, maxExp: 10, salaryMin: 40000, salaryMax: 60000,
    required: ['Stakeholder Management', 'Agile', 'JIRA', 'Communication'],
    preferred: ['PMP', 'PRINCE2', 'Business Analysis'],
    summary: 'Run enterprise implementation projects for government and large private-sector clients.',
    responsibilities: ['Own delivery plan, budget and risk for your projects', 'Keep stakeholders genuinely informed', 'Run governance and steering forums'],
    qualifications: ['5+ years project management', 'PMP or PRINCE2 preferred'],
  },
  {
    title: 'Scrum Master',
    designation: 'Scrum Master',
    department: 'PMO',
    minExp: 4, maxExp: 8, salaryMin: 36000, salaryMax: 54000,
    required: ['Scrum', 'Agile', 'Team Collaboration', 'JIRA'],
    preferred: ['Mentoring', 'Confluence'],
    summary: 'Help two delivery squads work well, and keep improving how they work.',
    responsibilities: ['Facilitate ceremonies and remove impediments', 'Coach teams on agile practice', 'Make flow and blockers visible'],
    qualifications: ['4+ years as a Scrum Master', 'CSM or PSM certification'],
  },

  // ---------------- IT Support ----------------
  {
    title: 'IT Support Specialist',
    designation: 'IT Support Specialist',
    department: 'ITS',
    minExp: 2, maxExp: 5, salaryMin: 20000, salaryMax: 32000,
    required: ['Active Directory', 'Microsoft 365', 'Service Desk', 'Hardware Troubleshooting'],
    preferred: ['ITIL', 'Networking (CCNA)', 'VMware'],
    summary: 'Keep colleagues productive — first-line and second-line support across the business.',
    responsibilities: ['Resolve service-desk tickets within SLA', 'Manage endpoints, accounts and access', 'Maintain IT asset records'],
    qualifications: ['2+ years IT support', 'Strong Windows and Microsoft 365 knowledge'],
  },
  {
    title: 'Systems Administrator',
    designation: 'Systems Administrator',
    department: 'ITS',
    minExp: 4, maxExp: 9, salaryMin: 30000, salaryMax: 46000,
    required: ['Linux Administration', 'VMware', 'Active Directory', 'Networking (CCNA)'],
    preferred: ['Ansible', 'AWS', 'ITIL'],
    summary: 'Own the internal systems and infrastructure the company runs on.',
    responsibilities: ['Administer servers, virtualisation and backups', 'Patch and harden systems', 'Support DR testing'],
    qualifications: ['4+ years systems administration'],
  },

  // ---------------- Sales ----------------
  {
    title: 'Enterprise Sales Manager',
    designation: 'Sales Manager',
    department: 'SAL',
    minExp: 6, maxExp: 12, salaryMin: 45000, salaryMax: 70000,
    required: ['Enterprise Sales', 'B2B Sales', 'Negotiation', 'Solution Selling'],
    preferred: ['Salesforce CRM', 'Tendering', 'Arabic (Business)'],
    summary: 'Win and grow enterprise accounts across government and large private-sector buyers.',
    responsibilities: ['Own a regional enterprise quota', 'Lead complex, multi-stakeholder sales cycles', 'Build durable executive relationships'],
    qualifications: ['6+ years enterprise B2B sales', 'Track record against quota in the region'],
  },
  {
    title: 'Business Development Executive',
    designation: 'BD Executive',
    department: 'SAL',
    minExp: 2, maxExp: 5, salaryMin: 22000, salaryMax: 36000,
    required: ['B2B Sales', 'Lead Generation', 'Communication'],
    preferred: ['Salesforce CRM', 'Arabic (Business)'],
    summary: 'Open new conversations and build the pipeline that feeds our enterprise team.',
    responsibilities: ['Generate and qualify new leads', 'Run discovery calls and product demos', 'Keep CRM data accurate'],
    qualifications: ['2+ years B2B sales or business development'],
  },
  {
    title: 'Pre-Sales Solutions Consultant',
    designation: 'Solutions Consultant',
    department: 'SAL',
    minExp: 5, maxExp: 10, salaryMin: 40000, salaryMax: 62000,
    required: ['Solution Selling', 'Presentation Skills', 'Business Analysis'],
    preferred: ['REST API Design', 'SQL', 'Tendering'],
    summary: 'Be the technical credibility in the room during enterprise sales cycles.',
    responsibilities: ['Lead technical discovery and solution design', 'Deliver demos and proofs of concept', 'Own technical responses in tenders'],
    qualifications: ['5+ years pre-sales or solution consulting'],
  },

  // ---------------- Marketing ----------------
  {
    title: 'Digital Marketing Manager',
    designation: 'Marketing Manager',
    department: 'MKT',
    minExp: 5, maxExp: 9, salaryMin: 34000, salaryMax: 52000,
    required: ['Campaign Management', 'SEO', 'Google Analytics', 'Content Marketing'],
    preferred: ['HubSpot', 'Email Marketing', 'Social Media Strategy'],
    summary: 'Own demand generation across channels and make the numbers defensible.',
    responsibilities: ['Plan and run multi-channel campaigns', 'Own the demand-generation funnel and its reporting', 'Manage agencies and budget'],
    qualifications: ['5+ years B2B digital marketing'],
  },
  {
    title: 'Content Marketing Specialist',
    designation: 'Content Specialist',
    department: 'MKT',
    minExp: 2, maxExp: 6, salaryMin: 24000, salaryMax: 38000,
    required: ['Content Marketing', 'SEO', 'Communication'],
    preferred: ['Social Media Strategy', 'Email Marketing', 'Arabic (Business)'],
    summary: 'Write the material that makes a complex B2B product understandable.',
    responsibilities: ['Produce articles, case studies and product content', 'Own the content calendar', 'Optimise for search and engagement'],
    qualifications: ['2+ years content marketing', 'Excellent written English'],
  },

  // ---------------- Customer Success ----------------
  {
    title: 'Customer Success Manager',
    designation: 'Customer Success Manager',
    department: 'CSU',
    minExp: 4, maxExp: 8, salaryMin: 32000, salaryMax: 50000,
    required: ['Account Management', 'Stakeholder Management', 'Communication'],
    preferred: ['Salesforce CRM', 'Arabic (Business)', 'Business Analysis'],
    summary: 'Own adoption, renewal and growth for a portfolio of enterprise accounts.',
    responsibilities: ['Drive onboarding and ongoing adoption', 'Run regular business reviews', 'Own renewal risk and expansion'],
    qualifications: ['4+ years customer success or account management in SaaS'],
  },
  {
    title: 'Technical Support Engineer',
    designation: 'Support Engineer',
    department: 'CSU',
    minExp: 2, maxExp: 6, salaryMin: 24000, salaryMax: 38000,
    required: ['Service Desk', 'SQL', 'Problem Solving', 'API Testing'],
    preferred: ['ITIL', 'Linux Administration', 'Arabic (Business)'],
    summary: 'Resolve the technical problems customers hit, and stop them recurring.',
    responsibilities: ['Investigate and resolve escalated technical issues', 'Work with engineering on root cause', 'Improve the knowledge base'],
    qualifications: ['2+ years technical support', 'Comfortable reading logs and writing SQL'],
  },

  // ---------------- Finance ----------------
  {
    title: 'Senior Accountant',
    designation: 'Senior Accountant',
    department: 'FIN',
    minExp: 5, maxExp: 9, salaryMin: 30000, salaryMax: 46000,
    required: ['IFRS', 'Financial Reporting', 'Audit'],
    preferred: ['SAP FICO', 'Cost Accounting', 'Treasury'],
    summary: 'Own month-end close and reporting for a growing regional business.',
    responsibilities: ['Run month-end and year-end close', 'Prepare statutory and management reporting', 'Support external audit'],
    qualifications: ['5+ years accounting', 'CA, ACCA or CPA part-qualified or qualified'],
  },
  {
    title: 'Financial Analyst',
    designation: 'Financial Analyst',
    department: 'FIN',
    minExp: 3, maxExp: 7, salaryMin: 28000, salaryMax: 44000,
    required: ['Budgeting & Forecasting', 'Financial Reporting', 'SQL'],
    preferred: ['Power BI', 'IFRS'],
    summary: 'Turn financial data into the analysis leadership actually plans against.',
    responsibilities: ['Build budgets, forecasts and variance analysis', 'Partner with department heads on their numbers', 'Support board reporting'],
    qualifications: ['3+ years FP&A or financial analysis'],
  },

  // ---------------- HR ----------------
  {
    title: 'Talent Acquisition Specialist',
    designation: 'TA Specialist',
    department: 'HR',
    minExp: 3, maxExp: 7, salaryMin: 26000, salaryMax: 40000,
    required: ['Recruitment', 'Talent Acquisition', 'Communication'],
    preferred: ['HRIS', 'Omanisation Compliance', 'Arabic (Business)'],
    summary: 'Own hiring end to end for technical and commercial roles.',
    responsibilities: ['Run full-cycle recruitment for your roles', 'Build pipelines for hard-to-fill skills', 'Give candidates a genuinely good experience'],
    qualifications: ['3+ years in-house or agency recruitment'],
  },
  {
    title: 'HR Business Partner',
    designation: 'HR Business Partner',
    department: 'HR',
    minExp: 5, maxExp: 10, salaryMin: 34000, salaryMax: 52000,
    required: ['Employee Relations', 'Performance Management', 'Stakeholder Management'],
    preferred: ['Learning & Development', 'HRIS', 'Omanisation Compliance'],
    summary: 'Partner with department leaders on everything people-related.',
    responsibilities: ['Advise managers on performance, capability and ER matters', 'Drive engagement and retention initiatives', 'Support organisational design'],
    qualifications: ['5+ years HR generalist or HRBP experience'],
  },

  // ---------------- Legal / Ops ----------------
  {
    title: 'Legal Counsel',
    designation: 'Legal Counsel',
    department: 'LEG',
    minExp: 5, maxExp: 11, salaryMin: 45000, salaryMax: 70000,
    required: ['Communication', 'Negotiation', 'Audit'],
    preferred: ['Arabic (Business)', 'ISO 27001'],
    summary: 'Advise the business on commercial contracts, data protection and regulatory matters.',
    responsibilities: ['Draft and negotiate commercial agreements', 'Advise on data protection and regulatory obligations', 'Manage external counsel'],
    qualifications: ['Qualified lawyer with 5+ years post-qualification experience', 'Regional commercial law experience'],
  },
  {
    title: 'Operations Manager',
    designation: 'Operations Manager',
    department: 'OPS',
    minExp: 5, maxExp: 10, salaryMin: 36000, salaryMax: 56000,
    required: ['Stakeholder Management', 'Business Analysis', 'Leadership'],
    preferred: ['Agile', 'Power BI', 'ITIL'],
    summary: 'Run the operational engine behind service delivery and keep it improving.',
    responsibilities: ['Own operational KPIs and service levels', 'Lead process improvement', 'Manage a small operations team'],
    qualifications: ['5+ years operations management'],
  },
];

// ---------------------------------------------------------------------
//  Candidate name pools
//
//  Weighted toward the markets we actually recruit from: Oman and the
//  wider Gulf, India, and a smaller international cohort.
// ---------------------------------------------------------------------

export const FIRST_NAMES_MALE = [
  'Ahmed', 'Ali', 'Khalid', 'Sultan', 'Said', 'Hamed', 'Yousuf', 'Salim', 'Nasser', 'Majid',
  'Abdullah', 'Omar', 'Hassan', 'Ibrahim', 'Tariq', 'Faisal', 'Rashid', 'Mohammed', 'Badar', 'Qais',
  'Rahul', 'Arjun', 'Vikram', 'Sanjay', 'Rohit', 'Amit', 'Karthik', 'Suresh', 'Praveen', 'Nikhil',
  'Deepak', 'Manoj', 'Anil', 'Ravi', 'Vijay', 'Ashok', 'Sunil', 'Rajesh', 'Harish', 'Naveen',
  'Daniel', 'Michael', 'James', 'Thomas', 'Peter', 'Stefan', 'Marco', 'Lucas', 'Ivan', 'Andrei',
  'Chinedu', 'Emeka', 'Kwame', 'Samuel', 'Joseph',
];

export const FIRST_NAMES_FEMALE = [
  'Aisha', 'Fatima', 'Maryam', 'Noor', 'Huda', 'Amal', 'Shaikha', 'Latifa', 'Zainab', 'Salma',
  'Reem', 'Lamya', 'Buthaina', 'Asma', 'Khadija', 'Muna', 'Sara', 'Dana', 'Layla', 'Hanan',
  'Priya', 'Anjali', 'Divya', 'Sneha', 'Pooja', 'Kavita', 'Meera', 'Lakshmi', 'Shruti', 'Nisha',
  'Deepika', 'Ritu', 'Swati', 'Neha', 'Aarti', 'Sunita', 'Rekha', 'Jyoti',
  'Emma', 'Sophia', 'Olivia', 'Hannah', 'Elena', 'Maria', 'Anna', 'Julia', 'Chiara', 'Lena',
  'Amara', 'Ngozi', 'Grace', 'Ruth',
];

export const LAST_NAMES = [
  'Al Balushi', 'Al Harthy', 'Al Lawati', 'Al Rawahi', 'Al Zadjali', 'Al Hinai', 'Al Kindi',
  'Al Shukaili', 'Al Maamari', 'Al Riyami', 'Al Busaidi', 'Al Farsi', 'Al Habsi', 'Al Siyabi',
  'Al Amri', 'Al Wahaibi', 'Al Mahrouqi', 'Al Saadi', 'Al Jabri', 'Al Nabhani',
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Menon', 'Iyer', 'Rao', 'Desai',
  'Gupta', 'Verma', 'Joshi', 'Pillai', 'Chopra', 'Malhotra', 'Bhat', 'Shetty', 'Kulkarni', 'Mehta',
  'Khan', 'Ahmed', 'Hussain', 'Siddiqui', 'Rahman', 'Chowdhury',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Miller', 'Schmidt', 'Rossi', 'Novak', 'Petrov', 'Kowalski',
  'Okafor', 'Mensah', 'Abebe', 'Mwangi',
];

export const UNIVERSITIES = [
  'Sultan Qaboos University', 'German University of Technology in Oman', 'Middle East College',
  'Muscat University', 'University of Nizwa', 'Dhofar University', 'Caledonian College of Engineering',
  'American University of Sharjah', 'Khalifa University', 'University of Dubai',
  'Indian Institute of Technology, Madras', 'Indian Institute of Technology, Delhi',
  'BITS Pilani', 'Anna University', 'VIT Vellore', 'Manipal Institute of Technology',
  'University of Mumbai', 'Delhi University', 'NIT Trichy', 'Osmania University',
  'University of Manchester', 'TU Munich', 'Politecnico di Milano', 'University of Warsaw',
];

export const DEGREES = [
  'BSc Computer Science', 'BEng Software Engineering', 'BSc Information Technology',
  'MSc Computer Science', 'BEng Computer Engineering', 'BSc Information Systems',
  'MBA', 'BCom Accounting', 'BSc Data Science', 'MSc Cybersecurity',
  'BA Business Administration', 'BSc Electronics & Communication', 'MSc Data Analytics',
  'BBA Marketing', 'LLB Law', 'BSc Statistics', 'MSc Information Security',
];

export const COMPANIES = [
  'Oman Telecommunications', 'Bank Muscat', 'Petroleum Development Oman', 'Omantel',
  'Ooredoo Oman', 'Oman Air', 'Asyad Group', 'OQ Group', 'Oman Arab Bank', 'Nawras',
  'Emirates NBD', 'Etisalat', 'du', 'Majid Al Futtaim', 'Emaar', 'DP World',
  'Infosys', 'TCS', 'Wipro', 'Tech Mahindra', 'HCL Technologies', 'Cognizant', 'Accenture',
  'Capgemini', 'Mindtree', 'Zoho', 'Freshworks', 'Flipkart', 'Paytm', 'Razorpay',
  'IBM', 'Oracle', 'SAP', 'Microsoft', 'Dell Technologies', 'Siemens',
  'KPMG', 'Deloitte', 'EY', 'PwC', 'Gulf Business Machines', 'Thales',
];

export const CURRENT_TITLES: Record<string, string[]> = {
  ENG: ['Software Engineer', 'Senior Software Engineer', 'Backend Developer', 'Frontend Developer', 'Full Stack Developer', 'Technical Lead', 'DevOps Engineer', 'Associate Software Engineer'],
  QAE: ['QA Engineer', 'Test Analyst', 'QA Automation Engineer', 'Senior QA Engineer', 'Test Lead'],
  DAT: ['Data Analyst', 'Data Engineer', 'BI Developer', 'Data Scientist', 'Analytics Engineer'],
  SEC: ['Security Analyst', 'Information Security Engineer', 'SOC Analyst', 'Compliance Officer'],
  PRD: ['Product Manager', 'Business Analyst', 'Product Owner', 'UX Designer', 'Product Designer'],
  PMO: ['Project Manager', 'Scrum Master', 'Delivery Manager', 'Project Coordinator'],
  ITS: ['IT Support Engineer', 'Systems Administrator', 'Service Desk Analyst', 'Network Administrator'],
  SAL: ['Sales Executive', 'Account Manager', 'Business Development Manager', 'Sales Manager', 'Solutions Consultant'],
  MKT: ['Marketing Executive', 'Digital Marketing Specialist', 'Content Writer', 'Marketing Manager'],
  CSU: ['Customer Success Manager', 'Support Engineer', 'Account Executive', 'Client Services Manager'],
  FIN: ['Accountant', 'Senior Accountant', 'Financial Analyst', 'Finance Manager'],
  HR: ['HR Executive', 'Recruiter', 'HR Business Partner', 'Talent Acquisition Specialist'],
  LEG: ['Legal Associate', 'Legal Counsel', 'Contracts Manager'],
  OPS: ['Operations Executive', 'Operations Manager', 'Process Analyst'],
};

// ---------------------------------------------------------------------
//  Qualitative content
// ---------------------------------------------------------------------

export const REJECTION_REASONS = [
  'Does not meet the minimum experience requirement for the role',
  'Technical assessment below the required standard',
  'Salary expectations significantly above the approved band',
  'Notice period incompatible with the required start date',
  'Stronger candidates progressed at this stage',
  'Limited relevant domain experience for this position',
  'Communication did not meet the level the role requires',
  'Candidate not available for the required work location',
  'Role requirements changed after the requisition was raised',
  'Did not attend the scheduled interview and did not respond to follow-up',
];

export const WITHDRAW_REASONS = [
  'Accepted an offer from another organisation',
  'No longer looking to change roles at this time',
  'Relocating outside the region',
  'Compensation expectations could not be met',
  'Decided to remain with current employer following a counter-offer',
];

export const DECLINE_REASONS = [
  'Accepted a competing offer with a higher base salary',
  'Counter-offer accepted from current employer',
  'Personal circumstances changed; unable to relocate',
  'Preferred a fully remote arrangement',
  'Start date could not be aligned with notice period',
];

export const SCREENING_REMARKS = [
  'Strong relevant background; worth progressing to the technical round.',
  'Good communication. Experience is slightly light but trajectory is promising.',
  'Solid technical fundamentals demonstrated during the screening call.',
  'Relevant domain experience; confirm notice period before progressing.',
  'Portfolio reviewed and looks credible. Progressing to technical assessment.',
  'Experience aligns well with the role. Salary expectation within band.',
  'Referred by an existing employee; background checks out.',
  'Some gaps against the required stack but strong adjacent experience.',
];

export const INTERVIEW_STRENGTHS = [
  'Clear, structured explanations and strong fundamentals.',
  'Excellent practical knowledge; gave concrete examples from recent work.',
  'Good system-design thinking and asked sensible clarifying questions.',
  'Strong communicator; explained trade-offs rather than just answers.',
  'Demonstrated genuine ownership on previous projects.',
  'Collaborative, and comfortable disagreeing constructively.',
  'Good grasp of testing and quality practices.',
  'Pragmatic about trade-offs between delivery speed and quality.',
];

export const INTERVIEW_IMPROVEMENTS = [
  'Limited depth on performance optimisation under load.',
  'Would benefit from broader exposure to cloud infrastructure.',
  'Could be more concise when answering scenario questions.',
  'Less experience with the specific framework we use day to day.',
  'Testing practice is lighter than we would like at this level.',
  'Would need support on stakeholder-facing communication initially.',
  'Architecture reasoning was sound but not yet at senior level.',
];

export const INTERVIEW_COMMENTS = [
  'Overall a positive conversation. Would be comfortable having them on the team.',
  'Capable candidate; recommend progressing to the next round.',
  'Good fit for the level advertised. No concerns from my side.',
  'Technically sound but worth probing design depth in the next round.',
  'Enthusiastic and well prepared; had clearly researched the company.',
  'Borderline at this level — would be a strong hire one grade below.',
  'Strong on delivery, lighter on the strategic side.',
];

export const RECRUITER_NOTES = [
  'Spoke to the candidate; available to interview any afternoon this week.',
  'Confirmed notice period is 30 days, negotiable to 2 weeks.',
  'Candidate is interviewing elsewhere — move quickly if we want them.',
  'Referred by an existing team member who vouches for their work.',
  'Open to relocating to Muscat; family already in the region.',
  'Salary expectation is at the top of band but negotiable for the right role.',
  'Strong portfolio. Shared the technical assessment brief.',
  'Rescheduled once already; confirmed the new slot by phone.',
  'Previously applied for a different role and was shortlisted.',
  'Good cultural fit based on the screening conversation.',
];

export const COVER_LETTER_OPENERS = [
  'I am writing to express my interest in the {title} position at Business Gateways.',
  'Having followed Business Gateways for some time, I was pleased to see the {title} role advertised.',
  'I would like to be considered for the {title} opening on your careers page.',
  'The {title} role caught my attention because it aligns closely with the work I have been doing.',
];

export const COVER_LETTER_BODIES = [
  'Over the past few years I have worked on systems with similar scale and complexity, and I am keen to apply that experience in a product-focused environment.',
  'My background spans both delivery and technical design, and I enjoy working close to the people who actually use what I build.',
  'I have spent most of my career in the region and understand the expectations of enterprise and public-sector clients here.',
  'What draws me to this role is the combination of technical depth and direct customer impact.',
  'I am looking for a role where I can take real ownership rather than working on a narrow slice, which is what this position appears to offer.',
];
