'use client';

import {
  BuildingOfficeIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function OrganizationSettings() {
  const [isEditing, setIsEditing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [organization, setOrganization] = useState({
    name: 'Overmatch Digital',
    legalName: 'Overmatch Digital Security LLC',
    ein: '88-1234567',
    website: 'https://overmatchdigital.com',
    email: 'contact@overmatchdigital.com',
    phone: '(210) 201-5759',
    address: {
      street: '8407 Bandera Rd',
      suite: 'Ste 103 #285',
      city: 'San Antonio',
      state: 'TX',
      zip: '78250',
      country: 'United States',
    },
    industry: 'Cybersecurity',
    size: '50-100',
    founded: '2020',
    description:
      'Leading provider of SOC 1 and SOC 2 compliance services, partnering with CPAs to deliver comprehensive audit and assessment solutions.',
  });

  const handleSave = () => {
    setIsEditing(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Organization Profile</h3>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setIsEditing(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} className="btn-primary">
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={organization.name}
                  onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900">{organization.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={organization.legalName}
                  onChange={(e) => setOrganization({ ...organization, legalName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900">{organization.legalName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EIN/Tax ID</label>
              {isEditing ? (
                <input
                  type="text"
                  value={organization.ein}
                  onChange={(e) => setOrganization({ ...organization, ein: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900">{organization.ein}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              {isEditing ? (
                <input
                  type="url"
                  value={organization.website}
                  onChange={(e) => setOrganization({ ...organization, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <a href={organization.website} className="text-primary-600 hover:text-primary-700">
                  {organization.website}
                </a>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={organization.email}
                  onChange={(e) => setOrganization({ ...organization, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900">{organization.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={organization.phone}
                  onChange={(e) => setOrganization({ ...organization, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ) : (
                <p className="text-gray-900">{organization.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Street Address"
                  value={organization.address.street}
                  onChange={(e) =>
                    setOrganization({
                      ...organization,
                      address: { ...organization.address, street: e.target.value },
                    })
                  }
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="Suite/Unit"
                  value={organization.address.suite}
                  onChange={(e) =>
                    setOrganization({
                      ...organization,
                      address: { ...organization.address, suite: e.target.value },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={organization.address.city}
                  onChange={(e) =>
                    setOrganization({
                      ...organization,
                      address: { ...organization.address, city: e.target.value },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="State"
                    value={organization.address.state}
                    onChange={(e) =>
                      setOrganization({
                        ...organization,
                        address: { ...organization.address, state: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="ZIP"
                    value={organization.address.zip}
                    onChange={(e) =>
                      setOrganization({
                        ...organization,
                        address: { ...organization.address, zip: e.target.value },
                      })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Country"
                  value={organization.address.country}
                  onChange={(e) =>
                    setOrganization({
                      ...organization,
                      address: { ...organization.address, country: e.target.value },
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            ) : (
              <p className="text-gray-900">
                {organization.address.street} {organization.address.suite}
                <br />
                {organization.address.city}, {organization.address.state} {organization.address.zip}
                <br />
                {organization.address.country}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            {isEditing ? (
              <textarea
                rows={3}
                value={organization.description}
                onChange={(e) => setOrganization({ ...organization, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            ) : (
              <p className="text-gray-900">{organization.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Branding</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 bg-gray-100 rounded-lg flex items-center justify-center">
                  <PhotoIcon className="h-10 w-10 text-gray-400" />
                </div>
                <div>
                  <button className="btn-secondary">Upload Logo</button>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand Colors</label>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 bg-primary-600 rounded"></div>
                <div className="h-10 w-10 bg-primary-500 rounded"></div>
                <div className="h-10 w-10 bg-gray-900 rounded"></div>
                <button className="btn-secondary ml-2">Customize</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaved && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-800">Organization settings saved successfully</p>
        </div>
      )}
    </div>
  );
}
