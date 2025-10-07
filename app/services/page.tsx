import {
  AcademicCapIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ServerIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

// Compliance Services Data
const complianceServices = [
  {
    id: 'soc1',
    name: 'SOC 1 Compliance',
    description:
      'Internal controls over financial reporting (ICFR) for service organizations impacting customer financial statements.',
    features: [
      'Financial reporting controls assessment',
      'Transaction processing validation',
      'Regulatory compliance verification',
      'Third-party risk management',
    ],
    idealFor: ['Payroll processors', 'Claims processors', 'Loan servicers', 'Data centers'],
    duration: '4-6 weeks',
    deliverables: [
      'Type I audit report',
      'Management assertion',
      'Control documentation',
      'Remediation roadmap',
    ],
  },
  {
    id: 'soc2',
    name: 'SOC 2 Compliance',
    description:
      'Trust Services Criteria evaluation covering security, availability, processing integrity, confidentiality, and privacy.',
    features: [
      'Security controls assessment',
      'Availability monitoring setup',
      'Processing integrity validation',
      'Privacy compliance verification',
    ],
    idealFor: ['SaaS companies', 'Cloud providers', 'Tech companies', 'Data processors'],
    duration: 'Type I: 4-6 weeks | Type II: 3-12 months',
    deliverables: [
      'Audit report',
      'Control matrix',
      'Risk assessment',
      'Continuous monitoring setup',
    ],
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description:
      'International standard for information security management systems (ISMS) certification.',
    features: [
      'ISMS implementation',
      'Risk assessment and treatment',
      'Policy development',
      'Internal audit preparation',
    ],
    idealFor: ['Global enterprises', 'Government contractors', 'Financial institutions'],
    duration: '3-6 months',
    deliverables: [
      'ISO certification',
      'ISMS documentation',
      'Policy library',
      'Training materials',
    ],
  },
  {
    id: 'hipaa',
    name: 'HIPAA Compliance',
    description:
      'Healthcare data security and privacy standards compliance for covered entities and business associates.',
    features: [
      'Security risk assessments',
      'Privacy rule compliance',
      'Breach notification procedures',
      'Business associate agreements',
    ],
    idealFor: ['Healthcare providers', 'Health tech companies', 'Medical device manufacturers'],
    duration: '6-8 weeks',
    deliverables: [
      'Risk assessment report',
      'Security policies',
      'BAA templates',
      'Compliance attestation',
    ],
  },
];

// Security Assessment Services
const assessmentServices = [
  {
    name: 'Penetration Testing',
    description: 'Comprehensive security testing to identify vulnerabilities before attackers do.',
    features: [
      'Network penetration testing',
      'Web application security testing',
      'Cloud infrastructure assessment',
      'Social engineering tests',
      'Executive reporting with remediation roadmap',
    ],
    methodology: 'OWASP, NIST, PTES frameworks',
    frequency: 'Quarterly or annually recommended',
  },
  {
    name: 'Vulnerability Assessments',
    description: 'Systematic evaluation of security weaknesses in your IT infrastructure.',
    features: [
      'Automated vulnerability scanning',
      'Manual verification of findings',
      'Risk scoring and prioritization',
      'Remediation guidance',
      'Compliance mapping',
    ],
    methodology: 'Automated + manual verification',
    frequency: 'Monthly continuous scanning available',
  },
  {
    name: 'Third-Party Risk Assessments',
    description: 'Evaluate and manage security risks from vendors and business partners.',
    features: [
      'Vendor security questionnaires',
      'Supply chain risk analysis',
      'Due diligence assessments',
      'Continuous vendor monitoring',
      'Risk scoring and reporting',
    ],
    methodology: 'NIST supply chain framework',
    frequency: 'Initial assessment + annual reviews',
  },
  {
    name: 'Cloud Security Assessment',
    description: 'Comprehensive review of your cloud infrastructure security posture.',
    features: [
      'AWS, Azure, GCP security reviews',
      'Identity and access management audit',
      'Data protection assessment',
      'Compliance validation',
      'Cost optimization recommendations',
    ],
    methodology: 'Cloud-native security frameworks',
    frequency: 'Quarterly recommended for dynamic environments',
  },
];

// Managed Security Services
const managedServices = [
  {
    name: '24/7 Security Monitoring',
    description: 'Round-the-clock monitoring and threat detection for your critical assets.',
    features: [
      'SIEM deployment and management',
      'Real-time threat detection',
      'Incident response coordination',
      'Monthly security reports',
      'Compliance log management',
    ],
    coverage: '24/7/365 monitoring',
    response: '15-minute SLA for critical incidents',
  },
  {
    name: 'Incident Response Services',
    description: 'Rapid response and remediation when security incidents occur.',
    features: [
      'Incident response planning',
      'Forensics and investigation',
      '24/7 emergency response',
      'Breach notification support',
      'Post-incident analysis',
    ],
    availability: '24/7 emergency hotline',
    expertise: 'Certified incident responders',
  },
  {
    name: 'Continuous Compliance Monitoring',
    description: 'Maintain compliance posture with automated monitoring and reporting.',
    features: [
      'Automated evidence collection',
      'Control effectiveness tracking',
      'Compliance dashboard access',
      'Quarterly reviews',
      'Audit preparation support',
    ],
    platform: 'Cloud-based compliance dashboard',
    integration: 'Connects with major cloud providers',
  },
];

// Training and Advisory Services
const advisoryServices = [
  {
    name: 'Security Awareness Training',
    description: 'Comprehensive training programs to build a security-conscious culture.',
    features: [
      'Custom training content',
      'Phishing simulations',
      'Role-based training paths',
      'Progress tracking and reporting',
      'Annual security awareness campaigns',
    ],
    delivery: 'Online, in-person, or hybrid',
    languages: 'Available in multiple languages',
  },
  {
    name: 'Virtual CISO Services',
    description: 'Executive-level security leadership without the full-time commitment.',
    features: [
      'Security strategy development',
      'Board and executive reporting',
      'Security program management',
      'Vendor management',
      'Compliance oversight',
    ],
    engagement: 'Part-time or fractional basis',
    experience: 'Fortune 500 security leadership',
  },
];

// Service Delivery Phases
const servicePhases = [
  {
    phase: 'Phase 1',
    name: 'Discovery & Assessment',
    description: 'Comprehensive evaluation of current security posture and compliance gaps',
    duration: '2-4 weeks',
  },
  {
    phase: 'Phase 2',
    name: 'Remediation & Implementation',
    description: 'Address identified gaps and implement necessary controls',
    duration: '4-12 weeks',
  },
  {
    phase: 'Phase 3',
    name: 'Validation & Testing',
    description: 'Verify control effectiveness and conduct formal assessments',
    duration: '2-6 weeks',
  },
  {
    phase: 'Phase 4',
    name: 'Continuous Improvement',
    description: 'Ongoing monitoring, maintenance, and optimization',
    duration: 'Ongoing',
  },
];

export default function ServicesPage() {
  return (
    <div className="relative">
      {/* Full page gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-white via-40% to-white -z-20"></div>
      {/* Hero Section */}
      <section className="relative isolate min-h-screen flex items-center overflow-hidden">
        {/* Rotating decorative element */}
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[120deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl translate-y-1/2">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[150deg] bg-gradient-to-br from-primary-100 to-primary-300 opacity-10 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="container w-full relative z-10">
          <div className="mx-auto max-w-2xl py-24 sm:py-32">
            <div className="text-center">
              <h1 className="heading-1 text-secondary-900">
                Next-Gen Security
                <br />
                for Today's&nbsp;Threats
              </h1>
              <p className="mt-6 text-lead">
                Modern organizations face evolving challenges. Our advanced security solutions
                combine automation, expertise, and proactive defense to keep you ahead of emerging
                risks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Services */}
      <section id="compliance" className="section-padding relative">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <ShieldCheckIcon className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="heading-2 text-secondary-900">Compliance Services</h2>
              <p className="mt-4 text-lead">
                Expert guidance through major compliance frameworks with CPA partnership for
                authoritative attestation
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {complianceServices.map((service) => (
                <div key={service.id} id={service.id} className="card flex flex-col h-full">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-secondary-900">{service.name}</h3>
                    <p className="mt-3 text-secondary-600">{service.description}</p>

                    <div className="mt-6">
                      <h4 className="font-semibold text-secondary-900 mb-3">Key Features:</h4>
                      <ul className="space-y-2">
                        {service.features.map((feature) => (
                          <li key={feature} className="flex gap-3">
                            <CheckIcon className="h-5 w-5 flex-shrink-0 text-primary-600" />
                            <span className="text-sm text-secondary-600">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6">
                      <h4 className="font-semibold text-secondary-900 mb-2">Ideal for:</h4>
                      <p className="text-sm text-secondary-600">{service.idealFor.join(' • ')}</p>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
                      <div>
                        <p className="text-xs font-semibold text-secondary-500 uppercase">
                          Duration
                        </p>
                        <p className="text-sm text-secondary-900 mt-1">{service.duration}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-secondary-500 uppercase">
                          Deliverables
                        </p>
                        <p className="text-sm text-secondary-900 mt-1">
                          {service.deliverables.length} key items
                        </p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Link href="/contact" className="w-full btn-primary text-center">
                        Get Custom Quote
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Assessment Services */}
      <section id="assessments" className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <MagnifyingGlassIcon className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="heading-2 text-secondary-900">Security Assessment Services</h2>
              <p className="mt-4 text-lead">
                Identify vulnerabilities and strengthen your security posture with comprehensive
                assessments
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {assessmentServices.map((service) => (
                <div
                  key={service.name}
                  className="bg-white rounded-xl p-8 shadow-sm flex flex-col h-full"
                >
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-secondary-900">{service.name}</h3>
                    <p className="mt-3 text-secondary-600">{service.description}</p>

                    <ul className="mt-6 space-y-2">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex gap-3">
                          <CheckIcon className="h-5 w-5 flex-shrink-0 text-primary-600" />
                          <span className="text-sm text-secondary-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto">
                    <div className="mt-6 space-y-3 border-t pt-4">
                      <div>
                        <span className="text-xs font-semibold text-secondary-500 uppercase">
                          Methodology
                        </span>
                        <p className="text-sm text-secondary-900 mt-1">{service.methodology}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-secondary-500 uppercase">
                          Frequency
                        </span>
                        <p className="text-sm text-secondary-900 mt-1">{service.frequency}</p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Link href="/contact" className="w-full btn-primary text-center">
                        Request Assessment
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Managed Security Services */}
      <section id="managed" className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <ServerIcon className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="heading-2 text-secondary-900">Managed Security Services</h2>
              <p className="mt-4 text-lead">
                Continuous protection and monitoring with our expert security operations team
              </p>
            </div>

            <div className="space-y-8">
              {managedServices.map((service) => (
                <div key={service.name} className="card">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-secondary-900">{service.name}</h3>
                      <p className="mt-3 text-secondary-600">{service.description}</p>

                      <ul className="mt-6 space-y-2">
                        {service.features.map((feature) => (
                          <li key={feature} className="flex gap-3">
                            <CheckIcon className="h-5 w-5 flex-shrink-0 text-primary-600" />
                            <span className="text-sm text-secondary-600">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="lg:text-right space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-secondary-500 uppercase">
                          {service.coverage
                            ? 'Coverage'
                            : service.availability
                              ? 'Availability'
                              : 'Platform'}
                        </p>
                        <p className="text-sm text-secondary-900 mt-1">
                          {service.coverage || service.availability || service.platform}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-secondary-500 uppercase">
                          {service.response
                            ? 'Response Time'
                            : service.expertise
                              ? 'Expertise'
                              : 'Integration'}
                        </p>
                        <p className="text-sm text-secondary-900 mt-1">
                          {service.response || service.expertise || service.integration}
                        </p>
                      </div>
                      <Link href="/contact" className="btn-primary inline-block mt-4">
                        Get Started
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Training & Advisory Services */}
      <section id="advisory" className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <AcademicCapIcon className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="heading-2 text-secondary-900">Training & Advisory Services</h2>
              <p className="mt-4 text-lead">
                Build security expertise and strategic capabilities within your organization
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {advisoryServices.map((service) => (
                <div
                  key={service.name}
                  className="bg-white rounded-xl p-8 shadow-sm flex flex-col h-full"
                >
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-secondary-900">{service.name}</h3>
                    <p className="mt-3 text-secondary-600">{service.description}</p>

                    <ul className="mt-6 space-y-2">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex gap-3">
                          <CheckIcon className="h-5 w-5 flex-shrink-0 text-primary-600" />
                          <span className="text-sm text-secondary-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto">
                    <div className="mt-6 space-y-3 border-t pt-4">
                      <div>
                        <span className="text-xs font-semibold text-secondary-500 uppercase">
                          {service.delivery ? 'Delivery' : 'Engagement'}
                        </span>
                        <p className="text-sm text-secondary-900 mt-1">
                          {service.delivery || service.engagement}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-secondary-500 uppercase">
                          {service.languages ? 'Languages' : 'Experience'}
                        </span>
                        <p className="text-sm text-secondary-900 mt-1">
                          {service.languages || service.experience}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Link href="/contact" className="w-full btn-primary text-center">
                        Learn More
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service Delivery Framework */}
      <section className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="heading-2 text-secondary-900">Our Service Delivery Framework</h2>
              <p className="mt-4 text-lead">
                A proven methodology for delivering exceptional results
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {servicePhases.map((phase, idx) => (
                <div key={phase.phase} className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-white font-bold text-xl">
                    {idx + 1}
                  </div>
                  <h3 className="mt-4 font-bold text-secondary-900">{phase.name}</h3>
                  <p className="mt-2 text-sm text-secondary-600">{phase.description}</p>
                  <p className="mt-2 text-sm font-medium text-primary-600">{phase.duration}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-white">Ready to Strengthen Your Security Posture?</h2>
            <p className="mt-6 text-lg text-primary-100">
              Get a free consultation to discuss your security and compliance needs. Our experts
              will develop a customized solution for your organization.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/contact" className="btn-secondary">
                Schedule Free Consultation
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-semibold text-white flex items-center gap-2 hover:text-primary-100"
              >
                View Pricing Guide →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
