import { Injectable } from '@nestjs/common';

export interface Framework {
  name: string;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  categories: string[];
  totalControls: number;
}

@Injectable()
export class FrameworksService {
  private frameworks: Framework[] = [
    {
      name: 'SOC1',
      displayName: 'SOC 1',
      description: 'Service Organization Control 1 - Financial Reporting',
      version: '2017',
      publisher: 'AICPA',
      categories: ['Financial', 'Operational'],
      totalControls: 120,
    },
    {
      name: 'SOC2',
      displayName: 'SOC 2',
      description: 'Service Organization Control 2 - Trust Services Criteria',
      version: '2017',
      publisher: 'AICPA',
      categories: [
        'Security',
        'Availability',
        'Processing Integrity',
        'Confidentiality',
        'Privacy',
      ],
      totalControls: 64,
    },
    {
      name: 'ISO27001',
      displayName: 'ISO 27001',
      description: 'Information Security Management System',
      version: '2013',
      publisher: 'ISO',
      categories: ['Information Security'],
      totalControls: 114,
    },
    {
      name: 'NIST',
      displayName: 'NIST Cybersecurity Framework',
      description: 'Framework for Improving Critical Infrastructure Cybersecurity',
      version: '1.1',
      publisher: 'NIST',
      categories: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
      totalControls: 108,
    },
    {
      name: 'PCI-DSS',
      displayName: 'PCI DSS',
      description: 'Payment Card Industry Data Security Standard',
      version: '4.0',
      publisher: 'PCI Security Standards Council',
      categories: ['Payment Security'],
      totalControls: 264,
    },
    {
      name: 'HIPAA',
      displayName: 'HIPAA',
      description: 'Health Insurance Portability and Accountability Act',
      version: '2013',
      publisher: 'HHS',
      categories: ['Healthcare', 'Privacy'],
      totalControls: 78,
    },
    {
      name: 'GDPR',
      displayName: 'GDPR',
      description: 'General Data Protection Regulation',
      version: '2018',
      publisher: 'EU',
      categories: ['Privacy', 'Data Protection'],
      totalControls: 99,
    },
  ];

  async findAll(): Promise<Framework[]> {
    return this.frameworks;
  }

  async findOne(name: string): Promise<Framework> {
    const framework = this.frameworks.find((f) => f.name === name);
    if (!framework) {
      throw new Error(`Framework ${name} not found`);
    }
    return framework;
  }

  async getFrameworkRequirements(name: string): Promise<any[]> {
    const framework = await this.findOne(name);

    // This would typically fetch from a database
    // For now, returning sample requirements
    return [{
      framework: framework.name,
      requirements: this.getRequirementsByFramework(name),
    }];
  }

  private getRequirementsByFramework(name: string): any[] {
    const requirementsMap = {
      SOC2: [
        {
          category: 'Common Criteria (CC)',
          controls: [
            // CC1: Control Environment
            {
              code: 'CC1.1',
              name: 'Control Environment',
              description: 'The entity demonstrates a commitment to integrity and ethical values',
            },
            {
              code: 'CC1.2',
              name: 'Board Independence',
              description:
                'The board of directors demonstrates independence from management and exercises oversight',
            },
            {
              code: 'CC1.3',
              name: 'Management Philosophy',
              description:
                'Management establishes, with board oversight, structures, reporting lines, and appropriate authorities',
            },
            {
              code: 'CC1.4',
              name: 'Organizational Structure',
              description:
                'The entity demonstrates a commitment to attract, develop, and retain competent individuals',
            },
            {
              code: 'CC1.5',
              name: 'Human Resources',
              description:
                'The entity holds individuals accountable for their internal control responsibilities',
            },

            // CC2: Communication and Information
            {
              code: 'CC2.1',
              name: 'Internal Communication',
              description: 'The entity obtains or generates and uses relevant, quality information',
            },
            {
              code: 'CC2.2',
              name: 'External Communication',
              description:
                'The entity internally communicates information to support internal control',
            },
            {
              code: 'CC2.3',
              name: 'Communication Methods',
              description:
                'The entity communicates with external parties regarding internal control matters',
            },

            // CC3: Risk Assessment
            {
              code: 'CC3.1',
              name: 'Risk Identification',
              description:
                'The entity specifies objectives to enable identification and assessment of risks',
            },
            {
              code: 'CC3.2',
              name: 'Risk Analysis',
              description:
                'The entity identifies risks to achievement of objectives and analyzes risks',
            },
            {
              code: 'CC3.3',
              name: 'Fraud Risk',
              description: 'The entity considers the potential for fraud in assessing risks',
            },
            {
              code: 'CC3.4',
              name: 'Change Management',
              description:
                'The entity identifies and assesses changes that could impact internal control',
            },

            // CC4: Monitoring Activities
            {
              code: 'CC4.1',
              name: 'Ongoing Monitoring',
              description: 'The entity selects and develops ongoing and separate evaluations',
            },
            {
              code: 'CC4.2',
              name: 'Deficiency Evaluation',
              description: 'The entity evaluates and communicates internal control deficiencies',
            },

            // CC5: Control Activities
            {
              code: 'CC5.1',
              name: 'Control Selection',
              description: 'The entity selects and develops control activities to mitigate risks',
            },
            {
              code: 'CC5.2',
              name: 'Technology Controls',
              description:
                'The entity selects and develops general control activities over technology',
            },
            {
              code: 'CC5.3',
              name: 'Policy Deployment',
              description: 'The entity deploys control activities through policies and procedures',
            },

            // CC6: Logical and Physical Access
            {
              code: 'CC6.1',
              name: 'Logical Access Controls',
              description:
                'The entity implements logical access security software, infrastructure, and architectures',
            },
            {
              code: 'CC6.2',
              name: 'New User Access',
              description:
                'Prior to issuing system credentials and granting access, user registration and authorization',
            },
            {
              code: 'CC6.3',
              name: 'Access Removal',
              description: 'The entity removes logical and physical access rights upon termination',
            },
            {
              code: 'CC6.4',
              name: 'Access Reviews',
              description:
                'The entity reviews logical and physical access appropriateness periodically',
            },
            {
              code: 'CC6.5',
              name: 'Segregation of Duties',
              description:
                'The entity segregates incompatible duties and reviews segregation periodically',
            },
            {
              code: 'CC6.6',
              name: 'Physical Security',
              description: 'The entity protects against unauthorized physical access',
            },
            {
              code: 'CC6.7',
              name: 'Authentication',
              description: 'The entity authenticates users through unique credentials',
            },
            {
              code: 'CC6.8',
              name: 'Data Transmission',
              description:
                'The entity prevents or detects and acts upon unauthorized or malicious software',
            },

            // CC7: System Operations
            {
              code: 'CC7.1',
              name: 'Threat Detection',
              description:
                'The entity uses detection and monitoring procedures to identify anomalies',
            },
            {
              code: 'CC7.2',
              name: 'Incident Response',
              description:
                'The entity monitors system components for anomalies and responds to incidents',
            },
            {
              code: 'CC7.3',
              name: 'Security Evaluation',
              description: 'The entity evaluates security events to determine required response',
            },
            {
              code: 'CC7.4',
              name: 'Incident Communication',
              description:
                'The entity responds to identified security incidents and communicates results',
            },
            {
              code: 'CC7.5',
              name: 'Incident Recovery',
              description:
                'The entity identifies, develops, and implements activities to recover from incidents',
            },

            // CC8: Change Management
            {
              code: 'CC8.1',
              name: 'Change Authorization',
              description:
                'The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors infrastructure, data, software changes',
            },

            // CC9: Risk Mitigation
            {
              code: 'CC9.1',
              name: 'Vendor Risk',
              description:
                'The entity identifies, selects, and develops risk mitigation activities for vendor relationships',
            },
            {
              code: 'CC9.2',
              name: 'Vendor Monitoring',
              description:
                'The entity assesses and manages vendor relationships and vendor performance',
            },
          ],
        },
        {
          category: 'Additional Criteria for Availability (A)',
          controls: [
            {
              code: 'A1.1',
              name: 'Capacity Management',
              description:
                'The entity maintains, monitors, and evaluates current processing capacity',
            },
            {
              code: 'A1.2',
              name: 'Environmental Protection',
              description: 'The entity protects against environmental events',
            },
            {
              code: 'A1.3',
              name: 'Recovery Testing',
              description: 'The entity tests recovery plan procedures',
            },
          ],
        },
        {
          category: 'Additional Criteria for Confidentiality (C)',
          controls: [
            {
              code: 'C1.1',
              name: 'Data Classification',
              description: 'The entity identifies and maintains confidential information',
            },
            {
              code: 'C1.2',
              name: 'Data Disposal',
              description: 'The entity disposes of confidential information to meet objectives',
            },
          ],
        },
        {
          category: 'Additional Criteria for Processing Integrity (PI)',
          controls: [
            {
              code: 'PI1.1',
              name: 'Processing Accuracy',
              description: 'The entity implements policies and procedures for processing integrity',
            },
            {
              code: 'PI1.2',
              name: 'Data Completeness',
              description: 'The entity implements policies to ensure data completeness',
            },
            {
              code: 'PI1.3',
              name: 'Data Validity',
              description: 'The entity implements input validation and edit checks',
            },
            {
              code: 'PI1.4',
              name: 'Output Review',
              description: 'The entity reviews data output for accuracy and completeness',
            },
            {
              code: 'PI1.5',
              name: 'Processing Errors',
              description: 'The entity implements error handling procedures',
            },
          ],
        },
        {
          category: 'Additional Criteria for Privacy (P)',
          controls: [
            {
              code: 'P1.1',
              name: 'Privacy Notice',
              description: 'The entity provides notice about privacy practices',
            },
            {
              code: 'P2.1',
              name: 'Choice and Consent',
              description: 'The entity provides choices regarding personal information collection',
            },
            {
              code: 'P3.1',
              name: 'Collection',
              description: 'The entity collects personal information for identified purposes',
            },
            {
              code: 'P3.2',
              name: 'Information Usage',
              description: 'The entity limits use of personal information to identified purposes',
            },
            {
              code: 'P4.1',
              name: 'Access Rights',
              description: 'The entity provides individuals access to their personal information',
            },
            {
              code: 'P4.2',
              name: 'Data Correction',
              description: 'The entity corrects, amends, or appends personal information',
            },
            {
              code: 'P4.3',
              name: 'Data Portability',
              description: 'The entity provides personal information in machine-readable format',
            },
            {
              code: 'P5.1',
              name: 'Third-Party Disclosure',
              description:
                'The entity discloses personal information to third parties with consent',
            },
            {
              code: 'P5.2',
              name: 'Third-Party Agreements',
              description:
                'The entity has agreements with third parties regarding personal information',
            },
            {
              code: 'P6.1',
              name: 'Disclosure Notification',
              description: 'The entity notifies data subjects of breaches',
            },
            {
              code: 'P6.2',
              name: 'Regulatory Notification',
              description: 'The entity notifies regulators of breaches as required',
            },
            {
              code: 'P7.1',
              name: 'Data Quality',
              description:
                'The entity maintains accurate, complete, and relevant personal information',
            },
            {
              code: 'P8.1',
              name: 'Monitoring Compliance',
              description: 'The entity monitors compliance with privacy policies',
            },
          ],
        },
      ],
      SOC1: [
        {
          category: 'Control Environment',
          controls: [
            {
              code: 'CE1',
              name: 'Integrity and Ethical Values',
              description: 'Management demonstrates commitment to integrity and ethical values',
            },
            {
              code: 'CE2',
              name: 'Board Oversight',
              description: 'Board provides oversight of financial reporting and internal control',
            },
            {
              code: 'CE3',
              name: 'Organizational Structure',
              description: 'Management establishes organizational structure to achieve objectives',
            },
            {
              code: 'CE4',
              name: 'Competence Commitment',
              description: 'Entity demonstrates commitment to competence',
            },
            {
              code: 'CE5',
              name: 'Accountability',
              description: 'Entity enforces accountability for internal control responsibilities',
            },
          ],
        },
        {
          category: 'Risk Assessment',
          controls: [
            {
              code: 'RA1',
              name: 'Financial Reporting Objectives',
              description: 'Entity specifies financial reporting objectives',
            },
            {
              code: 'RA2',
              name: 'Financial Reporting Risks',
              description: 'Entity identifies and analyzes financial reporting risks',
            },
            {
              code: 'RA3',
              name: 'Fraud Risk Assessment',
              description: 'Entity assesses fraud risk related to financial reporting',
            },
            {
              code: 'RA4',
              name: 'Change Identification',
              description: 'Entity identifies changes affecting financial reporting',
            },
          ],
        },
        {
          category: 'Control Activities',
          controls: [
            {
              code: 'CA1',
              name: 'Authorization Controls',
              description: 'Transactions are properly authorized',
            },
            {
              code: 'CA2',
              name: 'Processing Controls',
              description: 'Transactions are processed completely and accurately',
            },
            {
              code: 'CA3',
              name: 'Recording Controls',
              description: 'Transactions are recorded in proper period',
            },
            {
              code: 'CA4',
              name: 'Asset Safeguarding',
              description: 'Assets are safeguarded from unauthorized access',
            },
            {
              code: 'CA5',
              name: 'Segregation of Duties',
              description: 'Incompatible duties are segregated',
            },
            {
              code: 'CA6',
              name: 'Technology Controls',
              description: 'General IT controls support application controls',
            },
          ],
        },
        {
          category: 'Information and Communication',
          controls: [
            {
              code: 'IC1',
              name: 'Financial Information Quality',
              description: 'Entity obtains quality financial information',
            },
            {
              code: 'IC2',
              name: 'Internal Communication',
              description: 'Entity communicates financial control information internally',
            },
            {
              code: 'IC3',
              name: 'External Communication',
              description: 'Entity communicates with external parties about financial controls',
            },
          ],
        },
        {
          category: 'Monitoring Activities',
          controls: [
            {
              code: 'MA1',
              name: 'Ongoing Evaluations',
              description: 'Entity conducts ongoing evaluations of controls',
            },
            {
              code: 'MA2',
              name: 'Separate Evaluations',
              description: 'Entity conducts separate evaluations of controls',
            },
            {
              code: 'MA3',
              name: 'Deficiency Communication',
              description: 'Entity evaluates and communicates control deficiencies',
            },
          ],
        },
      ],
      ISO27001: [
        {
          category: 'A.5 Information Security Policies',
          controls: [
            {
              code: 'A.5.1.1',
              name: 'Policies for information security',
              description:
                'A set of policies for information security shall be defined, approved by management, published and communicated',
            },
            {
              code: 'A.5.1.2',
              name: 'Review of policies',
              description:
                'The policies for information security shall be reviewed at planned intervals',
            },
          ],
        },
        {
          category: 'A.6 Organization of Information Security',
          controls: [
            {
              code: 'A.6.1.1',
              name: 'Information security roles and responsibilities',
              description:
                'All information security responsibilities shall be defined and allocated',
            },
            {
              code: 'A.6.1.2',
              name: 'Segregation of duties',
              description: 'Conflicting duties and areas of responsibility shall be segregated',
            },
            {
              code: 'A.6.1.3',
              name: 'Contact with authorities',
              description: 'Appropriate contacts with relevant authorities shall be maintained',
            },
            {
              code: 'A.6.1.4',
              name: 'Contact with special interest groups',
              description: 'Appropriate contacts with special interest groups shall be maintained',
            },
            {
              code: 'A.6.1.5',
              name: 'Information security in project management',
              description: 'Information security shall be addressed in project management',
            },
          ],
        },
        {
          category: 'A.7 Human Resource Security',
          controls: [
            {
              code: 'A.7.1.1',
              name: 'Screening',
              description:
                'Background verification checks on all candidates for employment shall be carried out',
            },
            {
              code: 'A.7.1.2',
              name: 'Terms and conditions of employment',
              description:
                "Contractual agreements shall state their and the organization's responsibilities for information security",
            },
            {
              code: 'A.7.2.1',
              name: 'Management responsibilities',
              description:
                'Management shall require all employees to apply information security in accordance with policies',
            },
            {
              code: 'A.7.2.2',
              name: 'Information security awareness',
              description:
                'All employees shall receive appropriate awareness education and training',
            },
            {
              code: 'A.7.2.3',
              name: 'Disciplinary process',
              description: 'A formal disciplinary process for security breaches shall be in place',
            },
            {
              code: 'A.7.3.1',
              name: 'Termination responsibilities',
              description:
                'Information security responsibilities that remain valid after termination shall be defined',
            },
          ],
        },
        {
          category: 'A.8 Asset Management',
          controls: [
            {
              code: 'A.8.1.1',
              name: 'Inventory of assets',
              description:
                'Assets associated with information shall be identified and an inventory maintained',
            },
            {
              code: 'A.8.1.2',
              name: 'Ownership of assets',
              description: 'Assets maintained in the inventory shall be owned',
            },
            {
              code: 'A.8.1.3',
              name: 'Acceptable use of assets',
              description: 'Rules for acceptable use of assets shall be identified and implemented',
            },
            {
              code: 'A.8.1.4',
              name: 'Return of assets',
              description: 'All employees shall return organizational assets upon termination',
            },
            {
              code: 'A.8.2.1',
              name: 'Classification of information',
              description: 'Information shall be classified in terms of value and sensitivity',
            },
            {
              code: 'A.8.2.2',
              name: 'Labelling of information',
              description:
                'An appropriate set of procedures for information labelling shall be developed',
            },
            {
              code: 'A.8.2.3',
              name: 'Handling of assets',
              description:
                'Procedures for handling assets shall be developed in accordance with classification',
            },
          ],
        },
        {
          category: 'A.9 Access Control',
          controls: [
            {
              code: 'A.9.1.1',
              name: 'Access control policy',
              description:
                'An access control policy shall be established based on business requirements',
            },
            {
              code: 'A.9.1.2',
              name: 'Access to networks',
              description:
                'Users shall only be provided with access to networks they are authorized to use',
            },
            {
              code: 'A.9.2.1',
              name: 'User registration',
              description:
                'A formal user registration and de-registration process shall be implemented',
            },
            {
              code: 'A.9.2.2',
              name: 'User access provisioning',
              description: 'A formal user access provisioning process shall be implemented',
            },
            {
              code: 'A.9.2.3',
              name: 'Management of privileged access',
              description: 'The allocation and use of privileged access rights shall be restricted',
            },
            {
              code: 'A.9.2.4',
              name: 'Management of secret authentication',
              description:
                'The allocation of secret authentication information shall be controlled',
            },
            {
              code: 'A.9.2.5',
              name: 'Review of user access rights',
              description: "Asset owners shall review users' access rights at regular intervals",
            },
            {
              code: 'A.9.2.6',
              name: 'Removal of access rights',
              description:
                'Access rights shall be removed upon termination or adjusted upon change',
            },
            {
              code: 'A.9.3.1',
              name: 'Use of secret authentication',
              description:
                'Users shall follow practices in the use of secret authentication information',
            },
            {
              code: 'A.9.4.1',
              name: 'Information access restriction',
              description: 'Access to information and application functions shall be restricted',
            },
            {
              code: 'A.9.4.2',
              name: 'Secure log-on procedures',
              description: 'Access to systems shall be controlled by secure log-on procedures',
            },
            {
              code: 'A.9.4.3',
              name: 'Password management system',
              description:
                'Password management systems shall be interactive and ensure quality passwords',
            },
            {
              code: 'A.9.4.4',
              name: 'Use of privileged utility programs',
              description: 'The use of utility programs that override controls shall be restricted',
            },
            {
              code: 'A.9.4.5',
              name: 'Access control to program source code',
              description: 'Access to program source code shall be restricted',
            },
          ],
        },
        {
          category: 'A.10 Cryptography',
          controls: [
            {
              code: 'A.10.1.1',
              name: 'Policy on cryptographic controls',
              description: 'A policy on the use of cryptographic controls shall be developed',
            },
            {
              code: 'A.10.1.2',
              name: 'Key management',
              description:
                'A policy on the use, protection and lifetime of cryptographic keys shall be developed',
            },
          ],
        },
        {
          category: 'A.11 Physical and Environmental Security',
          controls: [
            {
              code: 'A.11.1.1',
              name: 'Physical security perimeter',
              description: 'Security perimeters shall be defined and used to protect areas',
            },
            {
              code: 'A.11.1.2',
              name: 'Physical entry controls',
              description: 'Secure areas shall be protected by appropriate entry controls',
            },
            {
              code: 'A.11.1.3',
              name: 'Securing offices',
              description:
                'Physical security for offices, rooms and facilities shall be implemented',
            },
            {
              code: 'A.11.1.4',
              name: 'Protection from external threats',
              description:
                'Physical protection against natural disasters and malicious attacks shall be implemented',
            },
            {
              code: 'A.11.1.5',
              name: 'Working in secure areas',
              description: 'Procedures for working in secure areas shall be designed and applied',
            },
            {
              code: 'A.11.1.6',
              name: 'Delivery and loading areas',
              description: 'Access points such as delivery and loading areas shall be controlled',
            },
            {
              code: 'A.11.2.1',
              name: 'Equipment siting and protection',
              description: 'Equipment shall be sited and protected to reduce risks',
            },
            {
              code: 'A.11.2.2',
              name: 'Supporting utilities',
              description: 'Equipment shall be protected from power failures and disruptions',
            },
            {
              code: 'A.11.2.3',
              name: 'Cabling security',
              description: 'Power and telecommunications cabling shall be protected',
            },
            {
              code: 'A.11.2.4',
              name: 'Equipment maintenance',
              description: 'Equipment shall be correctly maintained to ensure availability',
            },
            {
              code: 'A.11.2.5',
              name: 'Removal of assets',
              description: 'Equipment shall not be taken off-site without authorization',
            },
            {
              code: 'A.11.2.6',
              name: 'Security of equipment off-premises',
              description: 'Security shall be applied to off-site assets',
            },
            {
              code: 'A.11.2.7',
              name: 'Secure disposal or reuse',
              description: 'Equipment containing storage media shall be verified before disposal',
            },
            {
              code: 'A.11.2.8',
              name: 'Unattended user equipment',
              description: 'Users shall ensure unattended equipment has appropriate protection',
            },
            {
              code: 'A.11.2.9',
              name: 'Clear desk and clear screen',
              description:
                'A clear desk policy for papers and removable storage media shall be adopted',
            },
          ],
        },
        {
          category: 'A.12 Operations Security',
          controls: [
            {
              code: 'A.12.1.1',
              name: 'Documented operating procedures',
              description: 'Operating procedures shall be documented and made available',
            },
            {
              code: 'A.12.1.2',
              name: 'Change management',
              description: 'Changes to systems shall be controlled',
            },
            {
              code: 'A.12.1.3',
              name: 'Capacity management',
              description: 'The use of resources shall be monitored and projections made',
            },
            {
              code: 'A.12.1.4',
              name: 'Separation of environments',
              description: 'Development, testing and operational environments shall be separated',
            },
            {
              code: 'A.12.2.1',
              name: 'Controls against malware',
              description:
                'Detection, prevention and recovery controls against malware shall be implemented',
            },
            {
              code: 'A.12.3.1',
              name: 'Information backup',
              description: 'Backup copies of information shall be taken and tested regularly',
            },
            {
              code: 'A.12.4.1',
              name: 'Event logging',
              description: 'Event logs recording user activities shall be produced and reviewed',
            },
            {
              code: 'A.12.4.2',
              name: 'Protection of log information',
              description: 'Logging facilities and log information shall be protected',
            },
            {
              code: 'A.12.4.3',
              name: 'Administrator logs',
              description: 'System administrator activities shall be logged and reviewed',
            },
            {
              code: 'A.12.4.4',
              name: 'Clock synchronization',
              description: 'Clocks of systems shall be synchronized to a reference time source',
            },
            {
              code: 'A.12.5.1',
              name: 'Installation of software',
              description: 'Procedures shall be implemented to control software installation',
            },
            {
              code: 'A.12.6.1',
              name: 'Management of vulnerabilities',
              description:
                'Information about technical vulnerabilities shall be obtained and addressed',
            },
            {
              code: 'A.12.6.2',
              name: 'Restrictions on software installation',
              description: 'Rules governing software installation by users shall be established',
            },
            {
              code: 'A.12.7.1',
              name: 'Information systems audit',
              description: 'Audit requirements shall be agreed and controlled',
            },
          ],
        },
        {
          category: 'A.13 Communications Security',
          controls: [
            {
              code: 'A.13.1.1',
              name: 'Network controls',
              description: 'Networks shall be managed and controlled to protect information',
            },
            {
              code: 'A.13.1.2',
              name: 'Security of network services',
              description: 'Security mechanisms for network services shall be identified',
            },
            {
              code: 'A.13.1.3',
              name: 'Segregation in networks',
              description: 'Groups of information services shall be segregated on networks',
            },
            {
              code: 'A.13.2.1',
              name: 'Information transfer policies',
              description: 'Policies and procedures shall be in place for information transfer',
            },
            {
              code: 'A.13.2.2',
              name: 'Agreements on information transfer',
              description: 'Agreements shall address secure transfer of information',
            },
            {
              code: 'A.13.2.3',
              name: 'Electronic messaging',
              description: 'Information in electronic messaging shall be protected',
            },
            {
              code: 'A.13.2.4',
              name: 'Confidentiality agreements',
              description: 'Requirements for confidentiality agreements shall be identified',
            },
          ],
        },
        {
          category: 'A.14 System Acquisition, Development and Maintenance',
          controls: [
            {
              code: 'A.14.1.1',
              name: 'Security requirements analysis',
              description:
                'Security requirements shall be included in requirements for new systems',
            },
            {
              code: 'A.14.1.2',
              name: 'Securing application services',
              description:
                'Information in application services on public networks shall be protected',
            },
            {
              code: 'A.14.1.3',
              name: 'Protecting application transactions',
              description: 'Information in application service transactions shall be protected',
            },
            {
              code: 'A.14.2.1',
              name: 'Secure development policy',
              description: 'Rules for secure software development shall be established',
            },
            {
              code: 'A.14.2.2',
              name: 'System change control',
              description: 'Changes to systems in development shall be controlled',
            },
            {
              code: 'A.14.2.3',
              name: 'Technical review of applications',
              description: 'Applications shall be reviewed when operating platforms change',
            },
            {
              code: 'A.14.2.4',
              name: 'Restrictions on changes',
              description: 'Modifications to software packages shall be discouraged',
            },
            {
              code: 'A.14.2.5',
              name: 'Secure system engineering',
              description: 'Principles for engineering secure systems shall be established',
            },
            {
              code: 'A.14.2.6',
              name: 'Secure development environment',
              description: 'Organizations shall establish secure development environments',
            },
            {
              code: 'A.14.2.7',
              name: 'Outsourced development',
              description: 'Outsourced system development shall be supervised and monitored',
            },
            {
              code: 'A.14.2.8',
              name: 'System security testing',
              description:
                'Testing of security functionality shall be carried out during development',
            },
            {
              code: 'A.14.2.9',
              name: 'System acceptance testing',
              description: 'Acceptance testing programs for new systems shall be established',
            },
            {
              code: 'A.14.3.1',
              name: 'Protection of test data',
              description: 'Test data shall be selected carefully and protected',
            },
          ],
        },
        {
          category: 'A.15 Supplier Relationships',
          controls: [
            {
              code: 'A.15.1.1',
              name: 'Information security in supplier relationships',
              description: 'Security requirements for suppliers shall be established',
            },
            {
              code: 'A.15.1.2',
              name: 'Addressing security in agreements',
              description: 'Security requirements shall be included in supplier agreements',
            },
            {
              code: 'A.15.1.3',
              name: 'ICT supply chain',
              description:
                'Agreements with suppliers shall include requirements for ICT supply chain',
            },
            {
              code: 'A.15.2.1',
              name: 'Monitoring supplier services',
              description: 'Organizations shall monitor and review supplier service delivery',
            },
            {
              code: 'A.15.2.2',
              name: 'Managing changes to supplier services',
              description: 'Changes to supplier services shall be managed',
            },
          ],
        },
        {
          category: 'A.16 Information Security Incident Management',
          controls: [
            {
              code: 'A.16.1.1',
              name: 'Responsibilities and procedures',
              description: 'Management responsibilities for incident response shall be established',
            },
            {
              code: 'A.16.1.2',
              name: 'Reporting information security events',
              description: 'Security events shall be reported through appropriate channels',
            },
            {
              code: 'A.16.1.3',
              name: 'Reporting information security weaknesses',
              description: 'Employees shall report observed security weaknesses',
            },
            {
              code: 'A.16.1.4',
              name: 'Assessment of events',
              description: 'Information security events shall be assessed and classified',
            },
            {
              code: 'A.16.1.5',
              name: 'Response to incidents',
              description: 'Information security incidents shall be responded to',
            },
            {
              code: 'A.16.1.6',
              name: 'Learning from incidents',
              description: 'Knowledge from incidents shall be used to reduce likelihood',
            },
            {
              code: 'A.16.1.7',
              name: 'Collection of evidence',
              description: 'Procedures for evidence collection shall be defined',
            },
          ],
        },
        {
          category: 'A.17 Information Security Aspects of Business Continuity',
          controls: [
            {
              code: 'A.17.1.1',
              name: 'Planning information security continuity',
              description: 'Requirements for information security continuity shall be determined',
            },
            {
              code: 'A.17.1.2',
              name: 'Implementing information security continuity',
              description: 'Processes for information security continuity shall be established',
            },
            {
              code: 'A.17.1.3',
              name: 'Verify information security continuity',
              description: 'Continuity controls shall be verified at regular intervals',
            },
            {
              code: 'A.17.2.1',
              name: 'Availability of facilities',
              description: 'Information processing facilities shall be implemented with redundancy',
            },
          ],
        },
        {
          category: 'A.18 Compliance',
          controls: [
            {
              code: 'A.18.1.1',
              name: 'Identification of legislation',
              description:
                'Applicable legislation and contractual requirements shall be identified',
            },
            {
              code: 'A.18.1.2',
              name: 'Intellectual property rights',
              description: 'Procedures to ensure compliance with IPR shall be implemented',
            },
            {
              code: 'A.18.1.3',
              name: 'Protection of records',
              description: 'Records shall be protected from loss and falsification',
            },
            {
              code: 'A.18.1.4',
              name: 'Privacy and PII',
              description: 'Privacy and protection of PII shall be ensured',
            },
            {
              code: 'A.18.1.5',
              name: 'Regulation of cryptographic controls',
              description: 'Cryptographic controls shall comply with agreements and laws',
            },
            {
              code: 'A.18.2.1',
              name: 'Independent review',
              description: 'Information security shall be reviewed independently',
            },
            {
              code: 'A.18.2.2',
              name: 'Compliance with policies',
              description: 'Managers shall review compliance with policies',
            },
            {
              code: 'A.18.2.3',
              name: 'Technical compliance review',
              description: 'Information systems shall be reviewed for compliance',
            },
          ],
        },
      ],
      HIPAA: [
        {
          category: 'Administrative Safeguards',
          controls: [
            {
              code: '164.308(a)(1)',
              name: 'Security Management Process',
              description:
                'Implement policies and procedures to prevent, detect, contain, and correct security violations',
            },
            {
              code: '164.308(a)(2)',
              name: 'Assigned Security Responsibility',
              description:
                'Identify the security official responsible for developing and implementing security policies',
            },
            {
              code: '164.308(a)(3)',
              name: 'Workforce Security',
              description:
                'Implement procedures for authorization and/or supervision of workforce members who access ePHI',
            },
            {
              code: '164.308(a)(4)',
              name: 'Information Access Management',
              description:
                'Implement policies for authorizing access to ePHI consistent with applicable requirements',
            },
            {
              code: '164.308(a)(5)',
              name: 'Security Awareness and Training',
              description:
                'Implement security awareness and training program for all workforce members',
            },
            {
              code: '164.308(a)(6)',
              name: 'Security Incident Procedures',
              description: 'Implement policies and procedures to address security incidents',
            },
            {
              code: '164.308(a)(7)',
              name: 'Contingency Plan',
              description:
                'Establish policies and procedures for responding to emergency that damages ePHI systems',
            },
            {
              code: '164.308(a)(8)',
              name: 'Evaluation',
              description:
                'Perform periodic technical and nontechnical evaluation of security measures',
            },
            {
              code: '164.308(b)(1)',
              name: 'Business Associate Contracts',
              description:
                'Obtain satisfactory assurances that business associates will appropriately safeguard ePHI',
            },
          ],
        },
        {
          category: 'Physical Safeguards',
          controls: [
            {
              code: '164.310(a)(1)',
              name: 'Facility Access Controls',
              description:
                'Implement policies to limit physical access to electronic information systems',
            },
            {
              code: '164.310(a)(2)',
              name: 'Workstation Use',
              description: 'Implement policies for proper workstation use and access to ePHI',
            },
            {
              code: '164.310(b)',
              name: 'Workstation Security',
              description: 'Implement physical safeguards for workstations that access ePHI',
            },
            {
              code: '164.310(c)',
              name: 'Device and Media Controls',
              description:
                'Implement policies for receipt and removal of hardware and media containing ePHI',
            },
          ],
        },
        {
          category: 'Technical Safeguards',
          controls: [
            {
              code: '164.312(a)(1)',
              name: 'Access Control',
              description:
                'Implement technical policies to allow access only to authorized persons',
            },
            {
              code: '164.312(a)(2)',
              name: 'Unique User Identification',
              description:
                'Assign unique name and/or number for identifying and tracking user identity',
            },
            {
              code: '164.312(b)',
              name: 'Audit Controls',
              description:
                'Implement mechanisms to record and examine activity in systems containing ePHI',
            },
            {
              code: '164.312(c)',
              name: 'Integrity',
              description:
                'Implement policies to ensure ePHI is not improperly altered or destroyed',
            },
            {
              code: '164.312(d)',
              name: 'Person or Entity Authentication',
              description: 'Implement procedures to verify person or entity seeking access to ePHI',
            },
            {
              code: '164.312(e)',
              name: 'Transmission Security',
              description:
                'Implement measures to guard against unauthorized access during transmission',
            },
          ],
        },
        {
          category: 'Organizational Requirements',
          controls: [
            {
              code: '164.314(a)',
              name: 'Business Associate Contracts',
              description: 'Ensure business associate agreements contain required elements',
            },
            {
              code: '164.314(b)',
              name: 'Other Arrangements',
              description:
                'Document satisfactory assurances for government entities and other arrangements',
            },
          ],
        },
        {
          category: 'Documentation Requirements',
          controls: [
            {
              code: '164.316(a)',
              name: 'Documentation',
              description: 'Maintain written documentation of policies and procedures',
            },
            {
              code: '164.316(b)',
              name: 'Time Limit',
              description: 'Retain documentation for 6 years from creation or last effective date',
            },
            {
              code: '164.316(c)',
              name: 'Updates',
              description: 'Review documentation periodically and update as needed',
            },
          ],
        },
      ],
    };

    return (requirementsMap as Record<string, any>)[name] || [];
  }
}
