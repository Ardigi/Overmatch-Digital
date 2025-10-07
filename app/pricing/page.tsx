import { CheckIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const tiers = [
  {
    name: 'Essentials',
    id: 'tier-essentials',
    href: '/contact',
    description: 'Perfect for startups and small businesses beginning their security journey',
    features: [
      'SOC 2 Type I or Type II readiness',
      'Basic vulnerability assessments',
      'Security policy templates',
      'Quarterly security reviews',
      'Email & phone support',
      'Compliance roadmap planning',
    ],
    featured: false,
  },
  {
    name: 'Professional',
    id: 'tier-professional',
    href: '/contact',
    description: 'Comprehensive security and compliance for growing organizations',
    features: [
      'Full SOC 2, ISO 27001, or HIPAA audits',
      'Advanced penetration testing',
      'Custom policy development',
      'Monthly security monitoring',
      'Dedicated account manager',
      'Employee security training',
      'Incident response planning',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    href: '/contact',
    description: 'Complete security program management for large organizations',
    features: [
      'Multiple compliance frameworks',
      '24/7 SOC monitoring',
      'Virtual CISO services',
      'Custom security solutions',
      'Executive reporting dashboards',
      'Priority incident response',
      'Dedicated security team',
      'Board-level presentations',
    ],
    featured: false,
  },
];

const additionalServices = [
  {
    name: 'Security Assessments',
    description: 'Comprehensive vulnerability assessments, penetration testing, and risk analysis',
  },
  {
    name: '24/7 Monitoring',
    description: 'Round-the-clock threat detection and incident response services',
  },
  {
    name: 'vCISO Services',
    description: 'Strategic security leadership and program development on-demand',
  },
  {
    name: 'Compliance Automation',
    description: 'Continuous compliance monitoring and evidence collection platform',
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate bg-gradient-to-b from-primary-50 via-white to-transparent min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[300deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl translate-y-1/2">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[330deg] bg-gradient-to-br from-primary-100 to-primary-300 opacity-10 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="container w-full relative z-10">
          <div className="mx-auto max-w-2xl py-24 sm:py-32">
            <div className="text-center">
              <h1 className="heading-1 text-secondary-900">
                Flexible Solutions for Every Organization
              </h1>
              <p className="mt-6 text-lead">
                From startups to enterprises, we offer customized security and compliance solutions
                that scale with your business needs and budget.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="section-padding relative">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="isolate mx-auto grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-3xl p-8 xl:p-10 ${
                    tier.featured
                      ? 'bg-primary-600 ring-2 ring-primary-600'
                      : 'bg-white ring-1 ring-secondary-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-x-4">
                    <h3
                      className={`text-lg font-semibold leading-8 ${
                        tier.featured ? 'text-white' : 'text-secondary-900'
                      }`}
                    >
                      {tier.name}
                    </h3>
                    {tier.featured && (
                      <p className="rounded-full bg-primary-500 px-2.5 py-1 text-xs font-semibold leading-5 text-white">
                        Most popular
                      </p>
                    )}
                  </div>
                  <p
                    className={`mt-4 text-sm leading-6 ${tier.featured ? 'text-primary-100' : 'text-secondary-600'}`}
                  >
                    {tier.description}
                  </p>
                  <p className={`mt-6 ${tier.featured ? 'text-white' : 'text-secondary-900'}`}>
                    <span className="text-sm font-medium">Contact us for custom pricing</span>
                  </p>
                  <ul
                    role="list"
                    className={`mt-8 space-y-3 text-sm leading-6 ${
                      tier.featured ? 'text-primary-100' : 'text-secondary-600'
                    }`}
                  >
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <CheckIcon
                          className={`h-6 w-5 flex-none ${tier.featured ? 'text-white' : 'text-primary-600'}`}
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={tier.href}
                    aria-describedby={tier.id}
                    className={`mt-8 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      tier.featured
                        ? 'bg-white text-primary-600 hover:bg-primary-50 focus-visible:outline-white'
                        : 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600'
                    }`}
                  >
                    Get a Quote
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-secondary-900">Additional Services</h2>
            <p className="mt-4 text-lead">
              Enhance your security posture with our comprehensive service offerings
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-6xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {additionalServices.map((service, index) => (
                <div
                  key={service.name}
                  className="group relative bg-white rounded-2xl p-8 shadow-sm border border-secondary-100 hover:shadow-lg hover:border-primary-200 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <CheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-secondary-900 group-hover:text-primary-700 transition-colors duration-300">
                        {service.name}
                      </h3>
                      <p className="mt-3 text-secondary-600 leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                  </div>
                  {/* Decorative gradient border */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/5 to-primary-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Factors */}
      <section className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <h2 className="heading-2 text-secondary-900 text-center">
              Factors That Affect Pricing
            </h2>
            <div className="mt-12 space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-secondary-900">
                  Organization Size & Complexity
                </h3>
                <p className="mt-2 text-secondary-600">
                  Larger organizations with multiple systems, locations, and complex IT
                  infrastructure typically require more extensive testing and documentation.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-secondary-900">
                  Number of Trust Services Criteria
                </h3>
                <p className="mt-2 text-secondary-600">
                  While Security is required, adding Availability, Processing Integrity,
                  Confidentiality, or Privacy criteria increases the audit scope and cost.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-secondary-900">Current Maturity Level</h3>
                <p className="mt-2 text-secondary-600">
                  Organizations with existing security controls and documentation typically require
                  less remediation work, resulting in lower overall costs.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-secondary-900">Audit Type & Timeline</h3>
                <p className="mt-2 text-secondary-600">
                  Type II audits with longer observation periods (6-12 months) are more
                  comprehensive and costly than Type I point-in-time assessments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-white">Get a Custom Quote</h2>
            <p className="mt-6 text-lg text-primary-100">
              Every organization is unique. Let's discuss your specific needs and create a
              customized compliance roadmap with transparent pricing.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/contact" className="btn-secondary">
                Request Quote
              </Link>
              <Link
                href="/services"
                className="text-sm font-semibold text-white hover:text-primary-100"
              >
                Learn more about our services →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
