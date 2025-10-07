'use client';

import { EnvelopeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';

const serviceTypes = [
  'SOC 1',
  'SOC 2 Type I',
  'SOC 2 Type II',
  'ISO 27001',
  'HIPAA',
  'Penetration Testing',
  'Security Assessment',
  '24/7 Monitoring',
  'vCISO Services',
  'Not Sure',
];
const companySizes = ['1-50', '51-200', '201-500', '501-1000', '1000+'];

export default function ContactPage() {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    companySize: '',
    serviceType: '',
    message: '',
    agreeToTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Handle form submission here
      console.log('Form submitted:', formData);

      showSuccess(
        'Inquiry Submitted Successfully!',
        'Thank you for your interest. We will contact you within 24 hours.'
      );

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        companySize: '',
        serviceType: '',
        message: '',
        agreeToTerms: false,
      });
    } catch (error) {
      showError(
        'Submission Failed',
        'There was an error submitting your inquiry. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate bg-gradient-to-b from-primary-50 via-white to-transparent min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[390deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl translate-y-1/2">
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[60deg] bg-gradient-to-br from-primary-100 to-primary-300 opacity-10 sm:left-[calc(50%+20rem)] sm:w-[72.1875rem]" />
        </div>
        <div className="container w-full relative z-10">
          <div className="mx-auto max-w-2xl py-24 sm:py-32">
            <div className="text-center">
              <h1 className="heading-1 text-secondary-900">
                Strengthen Your Security & Compliance
              </h1>
              <p className="mt-6 text-lead">
                Schedule a free consultation to discuss your cybersecurity needs. Whether it's
                compliance audits, penetration testing, or 24/7 monitoring, we'll create a
                customized solution for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="section-padding relative">
        <div className="container">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-3">
              {/* Contact Information */}
              <div className="lg:col-span-1">
                <h2 className="text-2xl font-bold text-secondary-900">
                  Let's discuss your security needs
                </h2>
                <p className="mt-4 text-secondary-600">
                  Our team of cybersecurity experts is ready to help protect your organization. Fill
                  out the form and we'll be in touch within 24 hours.
                </p>

                <dl className="mt-10 space-y-6">
                  <div className="flex gap-x-4">
                    <dt className="flex-none">
                      <EnvelopeIcon className="h-6 w-6 text-primary-600" aria-hidden="true" />
                    </dt>
                    <dd className="text-secondary-600">contact@overmatchdigital.com</dd>
                  </div>
                  <div className="flex gap-x-4">
                    <dt className="flex-none">
                      <PhoneIcon className="h-6 w-6 text-primary-600" aria-hidden="true" />
                    </dt>
                    <dd className="text-secondary-600">(210) 201-5759</dd>
                  </div>
                  <div className="flex gap-x-4">
                    <dt className="flex-none">
                      <MapPinIcon className="h-6 w-6 text-primary-600" aria-hidden="true" />
                    </dt>
                    <dd className="text-secondary-600">
                      8407 Bandera Rd Ste 103 #285
                      <br />
                      San Antonio, TX 78250
                    </dd>
                  </div>
                </dl>

                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-secondary-900">Office Hours</h3>
                  <p className="mt-2 text-secondary-600">
                    Monday - Friday: 9:00 AM - 6:00 PM EST
                    <br />
                    Saturday - Sunday: Closed
                  </p>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <form onSubmit={handleSubmit} className="card">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="firstName"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        First name
                      </label>
                      <div className="mt-2.5">
                        <input
                          type="text"
                          name="firstName"
                          id="firstName"
                          required
                          value={formData.firstName}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="lastName"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Last name
                      </label>
                      <div className="mt-2.5">
                        <input
                          type="text"
                          name="lastName"
                          id="lastName"
                          required
                          value={formData.lastName}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Email
                      </label>
                      <div className="mt-2.5">
                        <input
                          type="email"
                          name="email"
                          id="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Phone number
                      </label>
                      <div className="mt-2.5">
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="company"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Company
                      </label>
                      <div className="mt-2.5">
                        <input
                          type="text"
                          name="company"
                          id="company"
                          required
                          value={formData.company}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="companySize"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Company size
                      </label>
                      <div className="mt-2.5">
                        <select
                          name="companySize"
                          id="companySize"
                          required
                          value={formData.companySize}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        >
                          <option value="">Select size</option>
                          {companySizes.map((size) => (
                            <option key={size} value={size}>
                              {size} employees
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="serviceType"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Service needed
                      </label>
                      <div className="mt-2.5">
                        <select
                          name="serviceType"
                          id="serviceType"
                          required
                          value={formData.serviceType}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        >
                          <option value="">Select service</option>
                          {serviceTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="message"
                        className="block text-sm font-semibold leading-6 text-secondary-900"
                      >
                        Message
                      </label>
                      <div className="mt-2.5">
                        <textarea
                          name="message"
                          id="message"
                          rows={4}
                          value={formData.message}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-secondary-900 shadow-sm ring-1 ring-inset ring-secondary-300 placeholder:text-secondary-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                          placeholder="Tell us about your security challenges and what you're looking to achieve..."
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          name="agreeToTerms"
                          id="agreeToTerms"
                          required
                          checked={formData.agreeToTerms}
                          onChange={handleChange}
                          className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-600"
                        />
                        <label
                          htmlFor="agreeToTerms"
                          className="ml-3 text-sm leading-6 text-secondary-600"
                        >
                          I agree to the{' '}
                          <a
                            href="/privacy"
                            className="font-semibold text-primary-600 hover:text-primary-500"
                          >
                            privacy policy
                          </a>{' '}
                          and{' '}
                          <a
                            href="/terms"
                            className="font-semibold text-primary-600 hover:text-primary-500"
                          >
                            terms of service
                          </a>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="mt-10">
                    <LoadingButton
                      type="submit"
                      loading={isSubmitting}
                      className="block w-full btn-primary text-center"
                    >
                      Submit Inquiry
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding bg-secondary-50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-secondary-900">Frequently Asked Questions</h2>
          </div>
          <div className="mx-auto mt-16 max-w-3xl">
            <dl className="space-y-8">
              <div>
                <dt className="text-lg font-semibold text-secondary-900">
                  How quickly can you respond to security incidents?
                </dt>
                <dd className="mt-2 text-secondary-600">
                  Our 24/7 Security Operations Center responds to critical incidents within 15
                  minutes. For compliance audits, Type I typically takes 4-6 weeks, while Type II
                  requires a 3-12 month observation period.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold text-secondary-900">
                  What's included in the initial consultation?
                </dt>
                <dd className="mt-2 text-secondary-600">
                  Our free consultation includes a comprehensive security assessment, review of
                  compliance requirements, vulnerability analysis, and a customized roadmap with
                  timeline and pricing estimates.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold text-secondary-900">
                  What industries do you specialize in?
                </dt>
                <dd className="mt-2 text-secondary-600">
                  We work across all industries, with deep expertise in healthcare, financial
                  services, SaaS, and government contracting. Our services scale from startups to
                  enterprises.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
