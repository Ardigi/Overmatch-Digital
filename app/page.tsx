import {
  ArrowRightIcon,
  ChartBarIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

const features = [
  {
    name: 'Compliance Services',
    description:
      'SOC 1, SOC 2, ISO 27001, and HIPAA compliance with expert guidance and CPA partnerships for authoritative attestation.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Security Assessments',
    description:
      'Penetration testing, vulnerability assessments, and cloud security reviews to identify and remediate risks.',
    icon: DocumentCheckIcon,
  },
  {
    name: '24/7 Security Monitoring',
    description:
      'Round-the-clock threat detection, incident response, and SIEM management to protect your critical assets.',
    icon: UserGroupIcon,
  },
  {
    name: 'Advisory Services',
    description:
      'Virtual CISO, security awareness training, and strategic consulting to build robust security programs.',
    icon: ChartBarIcon,
  },
];

const stats = [
  { label: 'Successful Audits', value: '500+' },
  { label: 'Client Retention Rate', value: '95%' },
  { label: 'Average Time to Compliance', value: '90 Days' },
  { label: 'CPA Partners', value: '50+' },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate bg-gradient-to-b from-white via-primary-50/30 to-transparent min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl translate-y-1/2">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[60deg] bg-gradient-to-br from-primary-100 to-primary-300 opacity-10 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="container w-full relative z-10">
          <div className="mx-auto max-w-2xl py-24 sm:py-32">
            <div className="text-center">
              <h1 className="heading-1 text-secondary-900">
                Cybersecurity & Compliance Excellence
              </h1>
              <p className="mt-6 text-lead">
                Comprehensive security solutions and compliance expertise for modern organizations.
                From SOC 2 and ISO 27001 to penetration testing and 24/7 monitoring.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/contact" className="btn-primary">
                  Schedule Free Consultation
                </Link>
                <Link
                  href="/services"
                  className="text-sm font-semibold leading-6 text-secondary-900 flex items-center gap-2 hover:text-primary-600"
                >
                  Learn more <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding relative">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">
              Comprehensive Services
            </h2>
            <p className="mt-2 heading-2 text-secondary-900">
              Complete Cybersecurity & Compliance Solutions
            </p>
            <p className="mt-6 text-lead">
              From compliance audits to 24/7 security monitoring, we provide comprehensive
              protection and assurance for your organization's critical assets and data.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-6xl sm:mt-20 lg:mt-24">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="group relative bg-white rounded-2xl p-6 shadow-sm border border-secondary-100 hover:shadow-lg hover:border-primary-200 transition-all duration-300"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-center mb-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <feature.icon className="h-8 w-8 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <h3 className="text-lg font-bold text-secondary-900 group-hover:text-primary-700 transition-colors duration-300 mb-3">
                        {feature.name}
                      </h3>
                      <p className="text-secondary-600 leading-relaxed text-sm">
                        {feature.description}
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

      {/* Stats Section */}
      <section className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="heading-2 text-secondary-900">Trusted by organizations nationwide</h2>
              <p className="mt-4 text-lead">Our track record speaks for itself</p>
            </div>
            <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col bg-secondary-50 p-8">
                  <dt className="text-sm font-semibold leading-6 text-secondary-600">
                    {stat.label}
                  </dt>
                  <dd className="order-first text-3xl font-semibold tracking-tight text-primary-600">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Client Portal Section */}
      <section className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="heading-2 text-secondary-900">Access Your Compliance Portal</h2>
                <p className="mt-4 text-lead">
                  Monitor your audit progress, access compliance documentation, and collaborate with
                  your audit team in real-time.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-4">
                    <DocumentCheckIcon className="h-6 w-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-secondary-900">Real-Time Audit Progress</h3>
                      <p className="text-secondary-600 mt-1">
                        Track your compliance journey with live updates and milestone tracking
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <ShieldCheckIcon className="h-6 w-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-secondary-900">
                        Secure Document Repository
                      </h3>
                      <p className="text-secondary-600 mt-1">
                        Access all your compliance documents and evidence in one secure location
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <UserGroupIcon className="h-6 w-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-secondary-900">Team Collaboration</h3>
                      <p className="text-secondary-600 mt-1">
                        Communicate directly with your audit team and CPA partners
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-10 flex items-center gap-x-6">
                  <Link href="/auth/signin" className="btn-primary">
                    Login to Portal
                  </Link>
                  <Link
                    href="/client-portal"
                    className="text-sm font-semibold leading-6 text-secondary-900 flex items-center gap-2 hover:text-primary-600"
                  >
                    Learn more about the portal <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-secondary-900">
                      Client Dashboard Preview
                    </h3>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      Live Demo
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-secondary-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-secondary-600">
                          SOC 2 Audit Progress
                        </span>
                        <span className="text-sm font-semibold text-primary-600">78%</span>
                      </div>
                      <div className="w-full bg-secondary-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: '78%' }}
                        ></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary-600">142</p>
                        <p className="text-xs text-secondary-600 mt-1">Controls Tested</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">98%</p>
                        <p className="text-xs text-secondary-600 mt-1">Compliance Score</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-secondary-900">45</p>
                        <p className="text-xs text-secondary-600 mt-1">Days to Complete</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-secondary-900 mb-3">
                        Recent Activity
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <p className="text-sm text-secondary-600">
                            Access control policy approved
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <p className="text-sm text-secondary-600">
                            New evidence uploaded by audit team
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <p className="text-sm text-secondary-600">
                            Risk assessment review pending
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-white">Ready to strengthen your security posture?</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100">
              Join hundreds of organizations that trust Overmatch Digital for their cybersecurity
              and compliance needs. Get started with a free security consultation today.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/contact" className="btn-secondary">
                Schedule Consultation
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-semibold leading-6 text-white flex items-center gap-2 hover:text-primary-100"
              >
                View Pricing <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
