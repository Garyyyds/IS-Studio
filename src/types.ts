export type TaskStatus = 
  | 'backlog' 
  | 'investigating' 
  | 'in_progress' 
  | 'blocked' 
  | 'testing' 
  | 'done';

export type EnvironmentType = 
  | 'Production' 
  | 'Staging' 
  | 'DR / Failover' 
  | 'Corporate LAN' 
  | 'Internal Tooling' 
  | 'Cloud Infrastructure';

export type ITCategory = 
  | 'DevOps & SRE' 
  | 'Security & IAM' 
  | 'Database' 
  | 'Cloud Infra' 
  | 'Networking' 
  | 'Application' 
  | 'SysAdmin';

export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole; // 'admin' = IT Operations / Admin, 'user' = Employee / Requester
  department?: string;
  avatar?: string;
  createdAt?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  command?: string;
}

export interface Task {
  id: string;
  ticketNumber: string; // e.g. "INC-1042" or "REQ-2045"
  title: string;
  description: string;
  rawLogs?: string;
  errorSignature?: string;
  status: TaskStatus;
  automatedTags: string[];
  manualTags: string[];
  category: ITCategory;
  environment: EnvironmentType;
  affectedUsersEstimate?: number;
  assignee: {
    name: string;
    avatar: string;
    role: string;
    email: string;
  };
  requesterId?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterDepartment?: string;
  deviceInfo?: string;
  isUserSubmitted?: boolean;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  checklist: ChecklistItem[];
  linkedRunbookId?: string;
  incidentSummary?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  isAutoTagged: boolean;
}

export interface DiagnosticStep {
  title: string;
  cli: string;
  explanation: string;
  shellType: 'bash' | 'powershell' | 'kubectl' | 'sql' | 'docker' | 'general';
}

export interface RemediationStep {
  stepNumber: number;
  title: string;
  instruction: string;
  command?: string;
  dangerous?: boolean;
  verification: string;
}

export interface Runbook {
  id: string;
  code: string; // e.g. "SOP-SEC-042"
  title: string;
  category: ITCategory | string;
  environment: EnvironmentType | string;
  lastUpdated: string;
  author: string;
  authorRole: string;
  version: string;
  status: 'active' | 'draft' | 'deprecated';
  symptom: string;
  triggerAlertPatterns: string[];
  rootCauseAnalysis: string;
  diagnosticSteps: DiagnosticStep[];
  remediationSteps: RemediationStep[];
  rollbackPlan: string;
  postMortemChecklist: string[];
  relatedTaskIds: string[];
  tags: string[];
}

export interface TaggingRule {
  id: string;
  name: string;
  matchType: 'keyword' | 'regex' | 'environment' | 'impact_high';
  pattern: string; // keyword or regex pattern
  tagsToApply: string[];
  category?: ITCategory;
  enabled: boolean;
  description: string;
}

export interface UserSettings {
  visibleViews: {
    kanban: boolean;
    list: boolean;
    history: boolean;
    handbook: boolean;
    rules: boolean;
    analytics: boolean;
  };
  defaultView: 'kanban' | 'list' | 'history' | 'handbook' | 'rules' | 'analytics';
  themeMode: 'light' | 'dark' | 'system';
  workstationMode: 'personal' | 'team';
  completedTicketRetentionMinutes?: number; // Minutes a resolved ticket stays on the board (default 60 = 1 hour)
  showAutomatedTagsOnCards: boolean;
  showChecklistProgressOnCards: boolean;
  compactCards: boolean;
  operatorName: string;
  defaultEnvironment: EnvironmentType;
  defaultCategory: ITCategory;
}

export type ActiveTab = 'kanban' | 'list' | 'history' | 'handbook' | 'rules' | 'analytics' | 'settings';

export interface StorageStatusInfo {
  storageType: 'supabase' | 'file';
  supabase: {
    configured: boolean;
    connected: boolean;
    error: string | null;
    urlPreview: string | null;
    sqlSetup: string;
  };
  filePath: string;
  lastSaved: string | null;
}

export interface AssetFormItem {
  id: string;
  description: string;
  specModel: string;
  serialNumber: string;
  quantity: string;
  remarks: string;
}

export interface AssetFormData {
  employeeId: string;
  referenceNo: string;
  submittedBy: string;
  requestDate: string;
  department: string;
  location: string;
  items: AssetFormItem[];
  /** Section D tick boxes, indexed to the form config's options. */
  itReturnOptions?: boolean[];
  /** Section D free-text remarks. */
  itRemarks?: string;
}

export interface UserIdFormData {
  employeeId: string;
  /** Replaces the other forms' Reference No. on this sheet. */
  phoneExt: string;
  submittedBy: string;
  requestDate: string;
  department: string;
  location: string;
  /** Ticked systems from Section A, keyed by the row entry id. */
  systems: Record<string, boolean>;
  /** Write-in value for the "Others:" entry. */
  othersDetail: string;
  /** Single-select nature of the request; empty when nothing is chosen. */
  natureOfRequest: string;
}
