import { ITCategory } from '../types';

// Choices offered on the employee request form. Kept in one place so the
// portal form and anything that reports on tickets use the same wording.

export const SYSTEM_OPTIONS = [
  'E-mail',
  'FTP',
  'NAV',
  'File Server',
  'Internet',
  'Advance Retails System',
  'Network',
  'HRIS',
  'Ebuilder',
  'Printer',
  'Database',
  'Others',
];

export const CATEGORY_OPTIONS: { value: ITCategory; label: string }[] = [
  { value: 'Application', label: 'Software & Tool Access (Figma, Slack, Jira)' },
  { value: 'Networking', label: 'Network, Wi-Fi & Corporate VPN' },
  { value: 'SysAdmin', label: 'Hardware, Laptop, Monitor & Peripherals' },
  { value: 'Security & IAM', label: 'Password, SSO, Okta 2FA & Accounts' },
  { value: 'Cloud Infra', label: 'Cloud, Server & Infrastructure' },
  { value: 'Database', label: 'Database & Data Access' },
];

/** Per-file upload limit. The server enforces the same figure. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
