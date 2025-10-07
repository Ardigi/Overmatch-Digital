import Link from 'next/link';

const navigation = {
  services: [
    { name: 'Compliance Services', href: '/services#compliance' },
    { name: 'Security Assessments', href: '/services#assessments' },
    { name: 'Managed Security', href: '/services#managed' },
    { name: 'Advisory Services', href: '/services#advisory' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'CPA Partnerships', href: '/about#partnerships' },
    { name: 'Careers', href: '/careers' },
  ],
  resources: [
    { name: 'Trust Services Criteria', href: '/resources/trust-services' },
    { name: 'Compliance Guide', href: '/resources/compliance-guide' },
    { name: 'Case Studies', href: '/resources/case-studies' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Cookie Policy', href: '/cookies' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-secondary-900" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="container">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8 py-16">
          <div className="space-y-6">
            <div>
              <span className="text-2xl font-bold text-white">Overmatch Digital</span>
              <p className="mt-4 text-sm leading-6 text-secondary-300">
                Leading cybersecurity and compliance firm providing comprehensive security
                assessments, managed security services, and compliance audits with CPA partnership.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="text-xs text-secondary-400 font-medium px-3 py-1 border border-secondary-700 rounded">
                SOC 2 Type II Certified
              </div>
              <div className="text-xs text-secondary-400 font-medium px-3 py-1 border border-secondary-700 rounded">
                ISO 27001 Compliant
              </div>
              <div className="text-xs text-secondary-400 font-medium px-3 py-1 border border-secondary-700 rounded">
                HIPAA Compliant
              </div>
            </div>
            <Link
              href="/auth/signin"
              className="inline-flex items-center px-4 py-2 border border-secondary-700 rounded-lg text-sm font-medium text-white hover:bg-secondary-800 transition-colors"
            >
              Client Portal Login
            </Link>
            <div className="flex space-x-6">
              <a href="#" className="text-secondary-400 hover:text-secondary-300">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a href="#" className="text-secondary-400 hover:text-secondary-300">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-white">Services</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.services.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm leading-6 text-secondary-300 hover:text-white"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-white">Company</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.company.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm leading-6 text-secondary-300 hover:text-white"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-white">Resources</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.resources.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm leading-6 text-secondary-300 hover:text-white"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-white">Legal</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.legal.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm leading-6 text-secondary-300 hover:text-white"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-secondary-700 py-8">
          <p className="text-xs leading-5 text-secondary-400 text-center">
            &copy; {new Date().getFullYear()} Overmatch Digital. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
