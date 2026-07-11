import type { LegalSection } from '../../../shared/components/LegalSections';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    number: 1,
    title: 'Data Controller',
    paragraphs: [
      'The data controller responsible for processing your personal data is:',
      'BPS Technology Public Company Limited',
      '25/34–38, 47–51 Sukhumvit Road',
      'Pak Nam Subdistrict, Mueang Samut Prakan District',
      'Samut Prakan 10270, Thailand',
      'Tel: +66 2 755 2688',
    ],
  },
  {
    number: 2,
    title: 'Personal Data We Collect',
    blocks: [
      {
        type: 'paragraph',
        text: 'The Company may collect and process the following categories:',
      },
      {
        type: 'subTitle',
        text: '2.1 General Personal Data',
      },
      {
        type: 'bullets',
        items: ['Date of birth', 'Gender'],
      },
      {
        type: 'subTitle',
        text: '2.2 Health and Medical Data (Sensitive Personal Data)',
      },
      {
        type: 'bullets',
        items: [
          'Blood group',
          'Height and weight',
          'Allergy history',
          'Underlying diseases',
          'Medications used',
          'Family health history',
          'Organ donation status',
        ],
      },
      {
        type: 'subTitle',
        text: '2.3 Data from Medical Devices',
      },
      {
        type: 'bullets',
        items: [
          'Body temperature',
          'Blood pressure',
          'Blood oxygen level',
          'Blood glucose level',
          'Other data received from compatible health or medical devices',
        ],
      },
      {
        type: 'subTitle',
        text: '2.4 Emergency Contact and Insurance Information',
      },
      {
        type: 'bullets',
        items: ['Emergency contact details', 'Insurance provider and policy number'],
      },
      {
        type: 'subTitle',
        text: '2.5 Technical Data',
      },
      {
        type: 'bullets',
        items: ['Device type and operating system', 'Application usage data (for system operation and security)'],
      },
    ],
  },
  {
    number: 3,
    title: 'Purposes of Processing',
    paragraphs: ['The Company uses personal data for:'],
    bullets: [
      'Providing services and operating core application features',
      'Displaying health data and device data to users',
      'Generating automated health alerts or notifications',
      'Managing user accounts and subscriptions',
      'Ensuring security and preventing misuse',
      'Improving application performance and user experience',
      'Complying with laws and relevant requirements',
    ],
  },
  {
    number: 4,
    title: 'Legal Bases for Processing',
    paragraphs: [
      'The Company relies on legal bases under the Personal Data Protection Act B.E. 2562 (“PDPA”), including:',
      'You may withdraw consent at any time as stated in Section 10.',
      'Certain personal data may be necessary to perform the contract between you and the Company. If you do not provide such data, the Company may not be able to provide some or all features. Providing sensitive personal data is voluntary and subject to your explicit consent.',
    ],
    bullets: [
      'Explicit consent (for collection and processing of health/medical data)',
      'Contract necessity (to provide the application services requested)',
      'Legal obligation (where required by applicable law)',
      'Vital interests (for emergency-related features, as applicable)',
    ],
  },
  {
    number: 5,
    title: 'Automated Processing and Health Alerts',
    paragraphs: [
      'The application may automatically process health data and device data to generate alerts or notifications.',
      'You acknowledge that:',
    ],
    bullets: [
      'Alerts are for informational purposes only',
      'Alerts are not medical advice or diagnosis',
      'Automated processing may be inaccurate or incomplete',
    ],
  },
  {
    number: 6,
    title: 'Data Retention',
    paragraphs: [
      'The Company will retain personal data only as necessary to fulfill the purposes stated:',
    ],
    bullets: [
      'By default, health data and device data are retained for thirty (30) days',
      'You may choose paid packages or additional services that allow longer retention',
      'Personal data will be deleted, destroyed, or anonymized after account deletion or when no longer necessary, subject to legal requirements',
      'Backup data will be retained for a limited period and deleted automatically',
      'Retention periods may vary depending on data type and subscription plan',
    ],
  },
  {
    number: 7,
    title: 'Disclosure of Personal Data',
    paragraphs: ['The Company may disclose personal data to:', 'All third parties must implement appropriate personal data protection measures'],
    bullets: [
      'Cloud and infrastructure service providers',
      'Service providers supporting application operations',
      'Emergency contacts (if you enable this feature)',
      'Government agencies where required by law',
    ],
  },
  {
    number: 8,
    title: 'Cross-Border Data Transfer',
    paragraphs: [
      'Personal data may be transferred to or stored abroad as necessary to provide the application (e.g., cloud infrastructure). In such cases, the Company will ensure appropriate safeguards and standards as required by the PDPA.',
    ],
  },
  {
    number: 9,
    title: 'Your Rights as a Data Subject',
    paragraphs: ['Under the PDPA, you have the right to:', 'Exercise these rights by contacting us as stated in Section 1.'],
    bullets: [
      'Access your personal data',
      'Rectify inaccurate or incomplete data',
      'Request deletion, destruction, or anonymization via the application or by contacting the Company in writing',
      'Receive or transfer personal data (where required by law)',
    ],
  },
  {
    number: 10,
    title: 'Withdrawal of Consent',
    paragraphs: [
      'You may withdraw consent at any time through application settings or by contacting the Company. Please note that withdrawing consent for certain personal data or health data may result in some features being unavailable, restricted, or suspended. Withdrawal does not affect the lawfulness of processing carried out prior to withdrawal.',
    ],
  },
  {
    number: 11,
    title: 'Security Measures',
    paragraphs: [
      'The Company implements appropriate technical and organizational measures, including but not limited to:',
    ],
    bullets: ['Encryption in transit and at rest', 'Access controls and authentication', 'Monitoring and logging access to sensitive data'],
  },
  {
    number: 12,
    title: 'Personal Data Breach Notification',
    paragraphs: [
      'In the event of a personal data breach, the Company will follow appropriate procedures under the PDPA, including notifying relevant authorities and data subjects where legally required.',
    ],
  },
  {
    number: 13,
    title: 'Children’s Privacy',
    paragraphs: [
      'This application is not intended for persons under eighteen (18). The Company does not knowingly collect personal data from minors. If you believe a minor has provided personal data through the application, please contact the Company so we can take appropriate action.',
    ],
  },
  {
    number: 14,
    title: 'Changes to the Privacy Policy',
    paragraphs: [
      'The Company may update or amend this privacy policy from time to time. The updated policy will be published through the application.',
    ],
  },
  {
    number: 15,
    title: 'Severability',
    paragraphs: [
      'If any clause or agreement is invalid or unenforceable for any reason, the remaining clauses shall remain binding and enforceable between the parties.',
    ],
  },
  {
    number: 16,
    title: 'Contact Information and Data Protection Officer (DPO)',
    paragraphs: [
      'If you have questions, concerns, or requests regarding this privacy policy or personal data processing, please contact:',
      'Data Protection Officer (DPO)',
    ],
    bullets: [
      'Name: Sukanya Onrutee',
      'Email: sukanya.o@bpstechthai.com'
    ],
  },
];
