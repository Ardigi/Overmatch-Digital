import {
  ArrowRightIcon,
  BellIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentCheckIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

const features = [
  {
    name: 'Real-Time Audit Tracking',
    description:
      'Monitor your compliance journey with live progress updates, milestone tracking, and estimated completion dates.',
    icon: ChartBarIcon,
  },
  {
    name: 'Secure Document Management',
    description:
      'Access all audit documentation, policies, and evidence in a centralized, encrypted repository.',
    icon: DocumentCheckIcon,
  },
  {
    name: 'Direct Team Communication',
    description:
      'Collaborate seamlessly with your audit team and CPA partners through integrated messaging and notifications.',
    icon: UserGroupIcon,
  },
  {
    name: 'Compliance Dashboard',
    description:
      'View your compliance status, control effectiveness, and risk assessments in intuitive visualizations.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Automated Alerts',
    description:
      'Receive timely notifications about important updates, deadlines, and required actions.',
    icon: BellIcon,
  },
  {
    name: 'Audit History',
    description:
      'Access complete audit trails and historical compliance data for trend analysis and continuous improvement.',
    icon: ClockIcon,
  },
];

const benefits = [
  {
    title: 'Save Time',
    description:
      'Reduce audit preparation time by up to 60% with streamlined workflows and automated evidence collection.',
    icon: ClockIcon,
  },
  {
    title: 'Ensure Security',
    description:
      'Bank-level encryption and SOC 2 compliant infrastructure protect your sensitive compliance data.',
    icon: LockClosedIcon,
  },
  {
    title: 'Stay Informed',
    description:
      'Never miss critical updates with real-time notifications and comprehensive audit progress tracking.',
    icon: CheckCircleIcon,
  },
];

export default function ClientPortalPage() {
  return (
    <div className="relative">
      {/* Full page gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-white via-40% to-white -z-20"></div>
      {/* Hero Section */}
      <section className="relative isolate min-h-screen flex items-center overflow-hidden">
        {/* Rotating decorative element */}
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl translate-y-1/2">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[330deg] bg-gradient-to-br from-primary-100 to-primary-300 opacity-10 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="container w-full relative z-10">
          <div className="mx-auto max-w-2xl py-24 sm:py-32">
            <div className="text-center">
              <h1 className="heading-1 text-secondary-900">Your Compliance Command Center</h1>
              <p className="mt-6 text-lead">
                Access your personalized compliance portal to track audit progress, manage
                documentation, and collaborate with your dedicated audit team - all in one secure
                platform.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/auth/signin" className="btn-primary">
                  Login to Your Portal
                </Link>
                <Link
                  href="/contact"
                  className="text-sm font-semibold leading-6 text-secondary-900 flex items-center gap-2 hover:text-primary-600"
                >
                  Request Access <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">Portal Features</h2>
            <p className="mt-2 heading-2 text-secondary-900">
              Everything you need for compliance success
            </p>
            <p className="mt-6 text-lead">
              Our client portal provides comprehensive tools and insights to streamline your
              compliance journey and maintain continuous oversight of your audit progress.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="group bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all cursor-pointer transform hover:scale-[1.02] focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2"
                  tabIndex={0}
                  role="article"
                  aria-label={feature.name}
                >
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-secondary-900">
                    <feature.icon
                      className="h-10 w-10 flex-none text-primary-600 group-hover:text-primary-700 transition-colors"
                      aria-hidden="true"
                    />
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-secondary-600">
                    <p className="font-semibold text-secondary-900 group-hover:text-primary-700 transition-colors">
                      {feature.name}
                    </p>
                    <p className="mt-2 flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="heading-2 text-secondary-900">Why clients choose our portal</h2>
                <p className="mt-4 text-lead">
                  Our portal is designed with your success in mind, providing intuitive tools and
                  real-time insights that transform the audit experience.
                </p>
                <div className="mt-8 space-y-6">
                  {benefits.map((benefit) => (
                    <div key={benefit.title} className="flex items-start gap-4">
                      <benefit.icon className="h-6 w-6 text-primary-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-secondary-900">{benefit.title}</h3>
                        <p className="text-secondary-600 mt-1">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <img
                  src="https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                  alt="Team collaboration"
                  className="rounded-2xl shadow-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="section-padding bg-secondary-900">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <LockClosedIcon className="h-12 w-12 text-primary-400 mx-auto mb-6" />
            <h2 className="heading-2 text-white">Enterprise-Grade Security</h2>
            <p className="mt-4 text-lg text-secondary-300">
              Your compliance data is protected by bank-level encryption, multi-factor
              authentication, and SOC 2 Type II certified infrastructure. We maintain the highest
              security standards to ensure your sensitive information remains confidential and
              secure.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/services#managed" className="btn-secondary">
                Learn About Our Security
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-secondary-900">Ready to streamline your compliance?</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-secondary-600">
              Join hundreds of organizations that trust our portal for their compliance management
              needs. Get started today or contact us to learn more.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/auth/signin" className="btn-primary">
                Access Your Portal
              </Link>
              <Link
                href="/contact"
                className="text-sm font-semibold leading-6 text-secondary-900 flex items-center gap-2 hover:text-primary-600"
              >
                Contact Support <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
