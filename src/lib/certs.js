// Exam catalogue for the dropdown. Duration and passing score are the commonly published
// values; AWS changes them from time to time, so edit here if an exam guide says otherwise.
// Question count (65) and scored count (50) are set in exam.js and apply to every exam.
export const CERTS = [
  { id: 'clf-c02', code: 'CLF-C02', name: 'Cloud Practitioner', level: 'Foundational', durationMin: 90, passing: 700 },
  { id: 'aif-c01', code: 'AIF-C01', name: 'AI Practitioner', level: 'Foundational', durationMin: 90, passing: 700 },

  { id: 'saa-c03', code: 'SAA-C03', name: 'Solutions Architect – Associate', level: 'Associate', durationMin: 130, passing: 720 },
  { id: 'dva-c02', code: 'DVA-C02', name: 'Developer – Associate', level: 'Associate', durationMin: 130, passing: 720 },
  { id: 'soa-c02', code: 'SOA-C02', name: 'SysOps Administrator – Associate', level: 'Associate', durationMin: 130, passing: 720 },
  { id: 'dea-c01', code: 'DEA-C01', name: 'Data Engineer – Associate', level: 'Associate', durationMin: 130, passing: 720 },
  { id: 'mla-c01', code: 'MLA-C01', name: 'Machine Learning Engineer – Associate', level: 'Associate', durationMin: 130, passing: 720 },

  { id: 'sap-c02', code: 'SAP-C02', name: 'Solutions Architect – Professional', level: 'Professional', durationMin: 180, passing: 750 },
  { id: 'dop-c02', code: 'DOP-C02', name: 'DevOps Engineer – Professional', level: 'Professional', durationMin: 180, passing: 750 },

  { id: 'scs-c02', code: 'SCS-C02', name: 'Security – Specialty', level: 'Specialty', durationMin: 170, passing: 750 },
  { id: 'ans-c01', code: 'ANS-C01', name: 'Advanced Networking – Specialty', level: 'Specialty', durationMin: 170, passing: 750 },
];

export const LEVELS = ['Foundational', 'Associate', 'Professional', 'Specialty'];

export const findCert = (id) => CERTS.find((c) => c.id === id);
