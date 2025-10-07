import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const values = [
  {
    name: 'Trust & Integrity',
    description:
      'We build lasting relationships through transparent communication and ethical practices in every engagement.',
  },
  {
    name: 'Excellence',
    description:
      'We deliver exceptional service by maintaining the highest standards of quality and continuous improvement.',
  },
  {
    name: 'Innovation',
    description:
      'We leverage cutting-edge technology and automation to streamline compliance processes.',
  },
  {
    name: 'Partnership',
    description:
      'We collaborate closely with CPAs and clients to ensure comprehensive compliance solutions.',
  },
];

const stats = [
  { label: 'Years of Experience', value: '20+' },
  { label: 'Certified Professionals', value: '50+' },
  { label: 'Successful Audits', value: '500+' },
  { label: 'Client Satisfaction', value: '98%' },
];

const certifications = [
  'CISSP - Certified Information Systems Security Professional',
  'CISA - Certified Information Systems Auditor',
  'CCSP - Certified Cloud Security Professional',
  'ISO 27001 Lead Auditor',
];

export default function AboutPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate bg-gradient-to-b from-primary-50 via-white to-transparent min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[210deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl translate-y-1/2">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[240deg] bg-gradient-to-br from-primary-100 to-primary-300 opacity-10 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="container w-full relative z-10">
          <div className="mx-auto max-w-2xl py-24 sm:py-32">
            <div className="text-center">
              <h1 className="heading-1 text-secondary-900">About Overmatch Digital</h1>
              <p className="mt-6 text-lead">
                Leading cybersecurity firm providing comprehensive security solutions, risk
                management, and compliance services including SOC 1/2, ISO 27001, HIPAA, and PCI DSS
                audits nationwide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="section-padding relative">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <h2 className="heading-2 text-secondary-900">Our Mission</h2>
                <p className="mt-6 text-lg text-secondary-600">
                  At Overmatch Digital, we protect organizations from evolving cyber threats while
                  making security and compliance accessible to businesses of all sizes. We believe
                  robust cybersecurity shouldn't be a barrier to growth, but a foundation for trust
                  and innovation.
                </p>
                <p className="mt-4 text-lg text-secondary-600">
                  Through comprehensive security services, strategic CPA partnerships, and expertise
                  across multiple compliance frameworks, we deliver solutions that strengthen your
                  security posture, meet regulatory requirements, and enable confident digital
                  transformation.
                </p>
                <div className="mt-8">
                  <Link href="/services" className="btn-primary">
                    Explore Our Services
                  </Link>
                </div>
              </div>
              <div className="bg-secondary-50 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-secondary-900 mb-6">
                  Why Choose Overmatch Digital?
                </h3>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-primary-600 flex-shrink-0" />
                    <span className="text-secondary-600">
                      Expert team with 20+ years of compliance experience
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-primary-600 flex-shrink-0" />
                    <span className="text-secondary-600">
                      Strategic CPA partnerships for authoritative audits
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-primary-600 flex-shrink-0" />
                    <span className="text-secondary-600">
                      Proven methodologies with 98% client satisfaction
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-primary-600 flex-shrink-0" />
                    <span className="text-secondary-600">
                      Comprehensive automation and continuous monitoring
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircleIcon className="h-6 w-6 text-primary-600 flex-shrink-0" />
                    <span className="text-secondary-600">
                      Transparent pricing with no hidden fees
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lone Star Loyalty Section */}
      <section className="section-padding bg-primary-50">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="heading-2 text-secondary-900">Lone Star Loyalty</h2>
            <p className="mt-6 text-lg text-secondary-600">
              As part of Texas's rich business ecosystem, we're a proud registered vendor on Texas'
              Centralized Master Bidders List (CMBL). This designation allows us to serve state
              agencies, educational institutions, and local governments throughout the Lone Star
              State.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-sm">
              <svg className="h-6 w-6 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="font-semibold text-secondary-900">Texas CMBL Registered Vendor</span>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-secondary-900">Our Core Values</h2>
            <p className="mt-4 text-lead">These principles guide everything we do</p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-4">
              {values.map((value) => (
                <div key={value.name} className="flex flex-col">
                  <dt className="text-lg font-semibold text-secondary-900">{value.name}</dt>
                  <dd className="mt-2 text-base text-secondary-600">{value.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="heading-2 text-secondary-900">Proven Track Record</h2>
            </div>
            <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col bg-primary-600 p-8">
                  <dt className="text-sm font-semibold leading-6 text-primary-100">{stat.label}</dt>
                  <dd className="order-first text-3xl font-semibold tracking-tight text-white">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Team Expertise Section */}
      <section className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h2 className="heading-2 text-secondary-900">Expert Team & Certifications</h2>
              <p className="mt-4 text-lead">
                Our team holds industry-leading certifications and maintains continuous education to
                stay ahead of evolving compliance requirements.
              </p>
            </div>
            <div className="mt-12">
              <h3 className="text-xl font-semibold text-secondary-900 mb-6">Key Certifications</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {certifications.map((cert) => (
                  <div key={cert} className="flex items-center gap-3 bg-white p-4 rounded-lg">
                    <CheckCircleIcon className="h-5 w-5 text-primary-600 flex-shrink-0" />
                    <span className="text-secondary-700">{cert}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CPA Partnership Section */}
      <section id="partnerships" className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="heading-2 text-secondary-900">Strategic CPA Partnerships</h2>
            <p className="mt-6 text-lg text-secondary-600">
              We maintain strong partnerships with leading CPA firms nationwide to ensure your SOC
              reports meet the highest standards of quality and regulatory compliance. Our
              collaborative approach combines technical cybersecurity expertise with authoritative
              audit attestation.
            </p>
            <div className="mt-10">
              <Link href="/contact" className="btn-primary">
                Learn About Our Partnerships
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-white">Ready to Work with the Experts?</h2>
            <p className="mt-6 text-lg text-primary-100">
              Join hundreds of organizations that trust Overmatch Digital for their SOC compliance
              needs.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/contact" className="btn-secondary">
                Get Started Today
              </Link>
              <Link
                href="/services"
                className="text-sm font-semibold text-white hover:text-primary-100"
              >
                View Our Services →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
