export type ConsentOption = {
  key: number;
  title: string;
  dataInvolved: string[];
  purposes: string[];
  checkboxText: string;
  noticeTitle?: string;
  noticeBody?: string;
};

export const CONSENT_NOTICE = {
  title: 'Consent for Collection and Processing of Personal and Health Data',
  lastUpdated: '19 February 2026',
  introParagraphs: [
    'To provide the UDMS application services, the Company needs to collect and process certain types of your personal data, including sensitive personal data relating to health, in accordance with the Personal Data Protection Act B.E. 2562 (“PDPA”).',
    'Please review the following consent details carefully. This notice explains the categories of data processing covered by your consent. Certain application functions may not be available if you do not provide consent for the application to process the relevant data.',
    'You may withdraw consent through the application settings or by contacting the Company as stated in the privacy policy.',
    'The data controller is BPS Technology Public Company Limited, as stated in the privacy policy. Your personal data may be transferred to or stored abroad as stated in the privacy policy.',
    'This consent is independent from acceptance of the Terms of Use. Without such data, the Company will not be able to provide the application’s core health services.',
  ],
  options: [
    {
      key: 1,
      title: 'Health Profile Data (Optional, you may provide this information to enhance your profile)',
      dataInvolved: [
        'Date of birth',
        'Gender',
        'Blood group',
        'Height and weight',
        'Allergy history',
        'Underlying diseases',
        'Medications used',
        'Family health history',
        'Organ donation status',
      ],
      purposes: ['To create and display your health profile', 'To provide health tracking services and display health results'],
      checkboxText: 'I consent to the collection and processing of my health profile data for the purposes stated above.',
    },
    {
      key: 2,
      title: 'Medical Device Data (Required for Core Health Services)',
      dataInvolved: [
        'Body temperature',
        'Blood pressure',
        'Blood oxygen level',
        'Blood glucose level',
        'Other data received from compatible medical/health devices',
      ],
      purposes: ['To display device data within the application', 'To support health tracking and analysis'],
      checkboxText: 'I consent to the collection and processing of my medical device data for the purposes stated above.',
    },
    {
      key: 3,
      title: 'Automated Health Alerts (Optional-only if you would like to receive alerts)',
      dataInvolved: ['Health profile data', 'Medical device data'],
      purposes: [
        'To automatically process health data',
        'To generate alerts/notifications when certain values fall outside predefined ranges',
      ],
      noticeTitle: 'Note:',
      noticeBody:
        'Health alerts are for informational purposes only and are not medical advice, diagnosis, or treatment.',
      checkboxText: 'I consent to automated processing of my health data for the purpose of generating health alerts.',
    },
    {
      key: 4,
      title: 'Emergency Contact Alerts (Optional-only if you wish to notify a trusted contact in emergencies)',
      dataInvolved: ['Emergency contact details', 'Health data relevant to the alert'],
      purposes: ['To notify the emergency contact you designate in situations you define as an emergency'],
      checkboxText: 'I consent to the use of my data to notify my designated emergency contact as stated above.',
    },
  ] as ConsentOption[],
  acknowledgement: {
    title: 'Acknowledgement and Confirmation of Consent',
    intro: 'By giving consent, I acknowledge and confirm that:',
    bullets: [
      'I have read and understood this consent notice',
      'I have read and understood the privacy policy',
      'I understand that I can withdraw consent at any time',
      'Withdrawal of consent may cause certain functions or services to be unavailable',
      'I will not claim any damages from the Company if such damages arise from my own actions',
    ],
  },
} as const;
