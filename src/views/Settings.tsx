import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import { apiRequest } from '../lib/api';
import { useBranding } from '../settings/BrandingContext';

type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'password' | 'image';
type Field = {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  required?: boolean;
  help: string;
  defaultValue?: any;
};
type Page = { id: string; label: string; description: string; fields: Field[] };

function f(
  key: string,
  label: string,
  help: string,
  required = false,
  type: FieldType = 'text',
  options?: string[],
  defaultValue?: any
): Field {
  return { key, label, help, required, type, options, defaultValue };
}

const pages: Page[] = [
  {
    id: 'school-profile',
    label: 'School Profile',
    description: 'Legal identity, contact details, academic calendar, and operational school information.',
    fields: [
      f('schoolName', 'School name', 'Official name shown across portals and documents', true),
      f('logoUrl', 'School logo / favicon', 'Upload the logo used across the LMS, browser favicon, and installed app icon', false, 'image'),
      f('emisNumber', 'EMIS number', 'Government education management identifier'),
      f('timezone', 'Timezone', 'Used by timetables, automation, and audit timestamps', true, 'select', ['Africa/Johannesburg', 'UTC', 'Africa/Gaborone']),
      f('academicYear', 'Current academic year', 'Active year for classes and reporting', true, 'number'),
    ],
  },
  {
    id: 'users',
    label: 'Users',
    description: 'Identity lifecycle defaults for staff, students, parents, volunteers, and contractors.',
    fields: [
      f('defaultRole', 'Default internal user role', 'Role assigned when no explicit role is supplied', true, 'select', ['Teacher', 'Operational Staff', 'Parent']),
      f('passwordExpiryDays', 'Password expiry (days)', 'Forces password rotation after this period', false, 'number', undefined, 90),
      f('archiveAlumni', 'Automatically archive alumni', 'Deactivates student access after graduation', false, 'boolean'),
    ],
  },
  {
    id: 'roles-permissions',
    label: 'Roles & Permissions',
    description: 'Permission inheritance, temporary access, and departmental scope controls.',
    fields: [
      f('inheritPermissions', 'Enable permission inheritance', 'Allows custom roles to inherit a base role', false, 'boolean'),
      f('temporaryAccessHours', 'Temporary access duration', 'Default expiry window for elevated permissions', false, 'number', undefined, 8),
      f('requireApproval', 'Require approval for role changes', 'Writes approved role mutations to the audit trail', false, 'boolean'),
    ],
  },
  {
    id: 'authentication',
    label: 'Authentication',
    description: 'Password, MFA, SSO, and trusted-domain authentication policy.',
    fields: [
      f('mfaRequired', 'Require MFA', 'Requires an additional sign-in factor for staff', false, 'boolean'),
      f('sessionTimeoutMinutes', 'Session timeout (minutes)', 'Ends idle authenticated sessions', true, 'number', undefined, 60),
      f('allowedDomains', 'Allowed email domains', 'Comma-separated domains permitted for staff signup'),
      f('ssoProvider', 'Single sign-on provider', 'Enterprise identity provider', false, 'select', ['None', 'Microsoft Entra ID', 'Google Workspace']),
    ],
  },
  {
    id: 'branding',
    label: 'Branding',
    description: 'White-label colours, typography, portal imagery, document identity.',
    fields: [
      f('primaryColor', 'Primary colour', 'Main navigation and action colour', true, 'text', undefined, '#1E3A8A'),
      f('accentColor', 'Accent colour', 'Highlights and status emphasis', true, 'text', undefined, '#3B82F6'),
      f('fontFamily', 'Portal font', 'Font used across branded portals', false, 'select', ['Inter', 'Roboto', 'Poppins', 'Open Sans']),
      f('schoolMotto', 'School motto', 'Displayed on formal documents and portals'),
      f('logoUrl', 'School logo', 'Used across the system and for the installed app icon', false, 'image'),
    ],
  },
  {
    id: 'email-services',
    label: 'Email Services',
    description: 'Outbound delivery provider, throttling, retry, and sender identity.',
    fields: [
      f('provider', 'Email provider', 'Provider used for transactional email', true, 'select', ['SMTP', 'Microsoft 365', 'Google Workspace', 'SendGrid', 'Amazon SES', 'Postmark', 'Resend']),
      f('fromAddress', 'Default from address', 'Verified sender for system messages', true),
      f('rateLimitPerMinute', 'Rate limit per minute', 'Protects sender reputation and provider limits', false, 'number', undefined, 60),
      f('retryFailures', 'Retry failed deliveries', 'Queues transient failures for delivery retry', false, 'boolean'),
    ],
  },
  {
    id: 'incoming-mail',
    label: 'Incoming Mail',
    description: 'Convert incoming mail into admissions, finance, support, and principal workflows.',
    fields: [
      f('enabled', 'Enable incoming mail processing', 'Polls configured IMAP or OAuth mailboxes', false, 'boolean'),
      f('pollIntervalMinutes', 'Polling interval', 'Frequency for checking new messages', false, 'number', undefined, 5),
      f('spamFiltering', 'Spam filtering', 'Rejects suspicious messages before workflow creation', false, 'boolean'),
      f('attachmentProcessing', 'Process attachments', 'Stores safe attachments against generated workflow records', false, 'boolean'),
    ],
  },
  {
    id: 'admissions',
    label: 'Admissions',
    description: 'Online application, waitlist, interview, payment, and verification behaviour.',
    fields: [
      f('waitlists', 'Enable waitlists', 'Allows applications to enter a waitlist state', false, 'boolean'),
      f('interviews', 'Require interviews', 'Adds interview scheduling before approval', false, 'boolean'),
      f('documentVerification', 'Verify submitted documents', 'Requires staff verification before placement', false, 'boolean'),
      f('placementTesting', 'Enable placement testing', 'Adds placement assessment to application workflow', false, 'boolean'),
    ],
  },
  {
    id: 'academic-settings',
    label: 'Academic Settings',
    description: 'Grades, terms, curriculum, promotion, and academic year rules.',
    fields: [
      f('termCount', 'Terms per year', 'Controls reporting and timetable periods', true, 'number', undefined, 4),
      f('promotionMark', 'Default promotion mark (%)', 'Minimum overall mark for grade promotion', true, 'number', undefined, 50),
      f('curriculum', 'Curriculum framework', 'Academic outcome framework', false, 'select', ['CAPS', 'Cambridge', 'IB', 'Custom']),
    ],
  },
  {
    id: 'parent-portal',
    label: 'Parent Portal',
    description: 'Control parent visibility and family engagement capabilities.',
    fields: [
      f('homeworkVisible', 'Show homework', 'Parents can view published class homework', false, 'boolean'),
      f('feeVisibility', 'Show fees and statements', 'Parents can view financial balances', false, 'boolean'),
      f('teacherMessaging', 'Allow teacher messaging', 'Parents can contact teachers linked to their children', false, 'boolean'),
      f('calendarSync', 'Enable calendar sync', 'Exposes family events through calendar feeds', false, 'boolean'),
    ],
  },
  {
    id: 'student-portal',
    label: 'Student Portal',
    description: 'Learner access to homework, resources, submissions, and results.',
    fields: [
      f('assignmentSubmission', 'Allow online submissions', 'Learners can upload assignment work', false, 'boolean'),
      f('resultsVisibility', 'Show published results', 'Learners can view released assessment marks', false, 'boolean'),
      f('resourceDownloads', 'Allow resource downloads', 'Learners can download teacher class materials', false, 'boolean'),
    ],
  },
  {
    id: 'timetable',
    label: 'Timetable',
    description: 'School day, period, room conflict, and substitution rules.',
    fields: [
      f('schoolDayStarts', 'School day starts', 'Default earliest timetable period', true, 'text', undefined, '07:30'),
      f('schoolDayEnds', 'School day ends', 'Default latest timetable period', true, 'text', undefined, '15:00'),
      f('preventConflicts', 'Prevent scheduling conflicts', 'Blocks teacher, class, and room overlaps', false, 'boolean'),
      f('allowSubstitutions', 'Allow teacher substitutions', 'Permits temporary timetable replacements', false, 'boolean'),
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Register, late-arrival, parent notification, GPS, and QR policies.',
    fields: [
      f('lateAfterMinutes', 'Late threshold (minutes)', 'Marks learners late after this threshold', true, 'number', undefined, 10),
      f('notifyParents', 'Notify parents of absence', 'Sends absence notifications after register submission', false, 'boolean'),
      f('gpsVerification', 'Require GPS verification', 'Validates attendance capture location', false, 'boolean'),
      f('qrAttendance', 'Enable QR attendance', 'Allows approved QR check-in workflows', false, 'boolean'),
    ],
  },
  {
    id: 'assessments',
    label: 'Assessments',
    description: 'Grading, moderation, pass marks, weightings, and publishing rules.',
    fields: [
      f('gradingSystem', 'Grading system', 'Mark representation used in reports', true, 'select', ['Percentage', 'Levels 1-7', 'Letter grades', 'Custom']),
      f('passMark', 'Default pass mark (%)', 'Baseline subject pass requirement', true, 'number', undefined, 50),
      f('moderationRequired', 'Require moderation', 'Prevents publishing until moderation is complete', false, 'boolean'),
      f('parentPublish', 'Publish to parent portal', 'Makes approved results visible to parents', false, 'boolean'),
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Announcements, messaging, consent, and escalation defaults.',
    fields: [
      f('defaultChannel', 'Default channel', 'Preferred school communication channel', true, 'select', ['Email', 'SMS', 'WhatsApp', 'Push', 'In-app']),
      f('quietHoursStart', 'Quiet hours start', 'Suppresses non-urgent delivery after this time', false, 'text', undefined, '20:00'),
      f('approvalRequired', 'Approve school-wide messages', 'Requires review before all-school delivery', false, 'boolean'),
    ],
  },
  {
    id: 'uniform-store',
    label: 'Uniform Store',
    description: 'Online ordering, collection, returns, sizing, and reorder behaviour.',
    fields: [
      f('onlineOrdering', 'Enable online ordering', 'Parents can purchase active products online', false, 'boolean'),
      f('defaultCollection', 'Default collection location', 'Pre-filled fulfilment point for new products', true),
      f('returnWindowDays', 'Return window (days)', 'Default return eligibility period', true, 'number', undefined, 14),
      f('autoProcurement', 'Auto-create low-stock requisitions', 'Creates procurement recommendations at minimum stock', false, 'boolean'),
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Low-stock, barcode, valuation, approval, and automatic ordering controls.',
    fields: [
      f('lowStockAlerts', 'Enable low-stock alerts', 'Creates inventory alerts below reorder point', false, 'boolean'),
      f('adjustmentApproval', 'Approve stock adjustments', 'Requires approval for material variances', false, 'boolean'),
      f('barcodeFormat', 'Barcode format', 'Default generated barcode standard', false, 'select', ['Code 128', 'EAN-13', 'QR']),
      f('valuationMethod', 'Valuation method', 'Cost method for inventory reports', false, 'select', ['Weighted average', 'FIFO', 'Standard cost']),
    ],
  },
  {
    id: 'supply-chain',
    label: 'Supply Chain',
    description: 'Procurement thresholds, supplier policy, RFQ, and approval routing.',
    fields: [
      f('rfqThreshold', 'RFQ threshold (R)', 'Requires multiple quotations above this value', true, 'number', undefined, 10000),
      f('principalApprovalThreshold', 'Principal approval threshold (R)', 'Escalates large purchases to the principal', true, 'number', undefined, 50000),
      f('minimumQuotes', 'Minimum quotations', 'Required compliant quotes for an RFQ', true, 'number', undefined, 3),
      f('preferredSuppliers', 'Enforce preferred suppliers', 'Warns when purchasing from non-preferred suppliers', false, 'boolean'),
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Currency, VAT, payment, fee visibility, and budget controls.',
    fields: [
      f('currency', 'Base currency', 'Currency used for school finance and store', true, 'select', ['ZAR', 'USD', 'BWP', 'EUR']),
      f('vatRate', 'Default VAT rate (%)', 'Default taxable purchase and store rate', true, 'number', undefined, 15),
      f('budgetWarnings', 'Enable budget warnings', 'Warns before committed spend exceeds allocation', false, 'boolean'),
      f('restrictReportsForDebt', 'Restrict reports for outstanding fees', 'Applies configured financial access policy', false, 'boolean'),
    ],
  },
  {
    id: 'licensing',
    label: 'Licensing',
    description: 'Plan, seats, storage, expiry, and module entitlement status.',
    fields: [
      f('plan', 'Current plan', 'Commercial plan for this school', true, 'select', ['Starter', 'Professional', 'Enterprise']),
      f('seatLimit', 'Licensed seats', 'Maximum active internal users', true, 'number', undefined, 250),
      f('storageGb', 'Storage allowance (GB)', 'Maximum school document storage', true, 'number', undefined, 100),
      f('expiryDate', 'Licence expiry date', 'Date on which renewal is required'),
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connected platforms, accounting, storage, payments, and collaboration.',
    fields: [
      f('microsoft365', 'Microsoft 365 enabled', 'Enables Microsoft identity and productivity integration', false, 'boolean'),
      f('googleWorkspace', 'Google Workspace enabled', 'Enables Google identity and Drive integration', false, 'boolean'),
      f('accountingProvider', 'Accounting provider', 'Finance ledger integration', false, 'select', ['None', 'Sage', 'Xero', 'QuickBooks']),
      f('storageProvider', 'Cloud storage provider', 'External document storage', false, 'select', ['Local', 'Azure Storage', 'AWS S3', 'Google Cloud']),
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    description: 'Scheduled operational jobs and assisted school workflows.',
    fields: [
      f('enabled', 'Enable automation engine', 'Runs active schedules and event rules', false, 'boolean'),
      f('dailyTeacherDigest', 'Daily teacher digest', 'Sends teachers their morning workbench summary', false, 'boolean'),
      f('monthlyInvoices', 'Monthly invoice run', 'Generates recurring fee invoices', false, 'boolean'),
      f('archiveAuditDays', 'Archive audit logs after days', 'Moves aged logs according to retention policy', false, 'number', undefined, 2555),
    ],
  },
  {
    id: 'workflow-rules',
    label: 'Workflow Rules',
    description: 'Event-driven approvals, actions, escalation, and notifications.',
    fields: [
      f('admissionOnboarding', 'Admission onboarding workflow', 'Creates learner, guardian, grade, finance, and orientation records', false, 'boolean'),
      f('lowStockProcurement', 'Low-stock procurement workflow', 'Creates purchase request and notifies Supply Chain', false, 'boolean'),
      f('feeEscalation', 'Outstanding fee escalation', 'Notifies finance and responsible guardians', false, 'boolean'),
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Granular event channels for email, SMS, push, WhatsApp, and in-app delivery.',
    fields: [
      f('email', 'Email notifications', 'Enables transactional email channel', false, 'boolean'),
      f('sms', 'SMS notifications', 'Enables configured SMS provider', false, 'boolean'),
      f('push', 'Push notifications', 'Enables browser and device push', false, 'boolean'),
      f('whatsapp', 'WhatsApp notifications', 'Enables approved WhatsApp templates', false, 'boolean'),
    ],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Device, network, session, encryption, API key, and risk policy.',
    fields: [
      f('securityScoreTarget', 'Security score target', 'Minimum acceptable configuration score', true, 'number', undefined, 80),
      f('trustedDevices', 'Allow trusted devices', 'Permits remembered MFA devices', false, 'boolean'),
      f('ipRestrictions', 'IP allow list', 'Comma-separated trusted network ranges'),
      f('apiKeyRotationDays', 'API key rotation (days)', 'Rotation reminder interval', false, 'number', undefined, 90),
    ],
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    description: 'Retention, export, device context, and compliance logging.',
    fields: [
      f('retentionDays', 'Retention period (days)', 'How long detailed audit records remain online', true, 'number', undefined, 2555),
      f('captureDevice', 'Capture device and browser', 'Adds client context to audit records', false, 'boolean'),
      f('exportEnabled', 'Allow audit exports', 'Permits authorised compliance exports', false, 'boolean'),
    ],
  },
  {
    id: 'backup-recovery',
    label: 'Backup & Recovery',
    description: 'Encrypted backups, restore points, retention, and cloud targets.',
    fields: [
      f('schedule', 'Backup schedule', 'Automated backup frequency', true, 'select', ['Daily', 'Weekly', 'Monthly']),
      f('retentionCount', 'Restore points retained', 'Number of encrypted backups to keep', true, 'number', undefined, 30),
      f('provider', 'Backup provider', 'Target for encrypted backup archives', true, 'select', ['Azure', 'AWS', 'Google Cloud', 'Local']),
      f('encryption', 'Encrypt backups', 'Requires encryption before upload', false, 'boolean'),
    ],
  },
  {
    id: 'developer-api',
    label: 'Developer API',
    description: 'API access, webhooks, OAuth clients, inspection, and rate limits.',
    fields: [
      f('enabled', 'Enable developer API', 'Allows active API clients to access permitted endpoints', false, 'boolean'),
      f('rateLimit', 'Requests per minute', 'Default API client throttling', true, 'number', undefined, 120),
      f('webhookRetries', 'Webhook retry attempts', 'Maximum retry attempts for failed deliveries', true, 'number', undefined, 5),
      f('requestLogging', 'Log API requests', 'Adds request details to API audit logs', false, 'boolean'),
    ],
  },
];

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10';

const permissionCatalog = [
  'operations:read', 'operations:write',
  'inventory:read', 'inventory:write',
  'requisitions:read', 'requisitions:write',
  'tickets:read', 'tickets:write',
  'store:read', 'store:write', 'uniform_store:store.manage',
  'students:read', 'students:create', 'teachers:create', 'users:manage', 'settings:manage',
  'communications:read', 'communications:write', 'communications:manage', 'admissions:manage', 'enquiries:read', 'appointments:read', 'appointments:update', 'appointments:manage', 'teacher_portal:read', 'teacher_portal:write',
  'discipline:read', 'discipline:write',
  'parent_portal:read', 'parent_portal:acknowledge',
  'student_portal:read', 'announcements:read', 'attendance:read', 'assessments:read',
];
const defaultRolePermissions: Record<string, string[]> = {
  ADMIN: permissionCatalog,
  TEACHER: ['tickets:read', 'tickets:write', 'students:read', 'discipline:read', 'discipline:write', 'communications:read', 'communications:write', 'appointments:read', 'appointments:update', 'teacher_portal:read', 'teacher_portal:write'],
  PARENT: ['parent_portal:read', 'parent_portal:acknowledge', 'store:read', 'tickets:read'],
  STUDENT: ['student_portal:read', 'attendance:read', 'assessments:read'],
};

async function readImageAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read logo file.'));
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const [activeId, setActiveId] = useState('school-profile');
  const [values, setValues] = useState<Record<string, any>>({});
  const [savedValues, setSavedValues] = useState<Record<string, any>>({});
  const [audit, setAudit] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [settingsNavOpen, setSettingsNavOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');
  const [userPage, setUserPage] = useState(1);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'TEACHER', password: '' });
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const { branding, refresh: refreshBranding } = useBranding();

  const active = pages.find((page) => page.id === activeId)!;

  useEffect(() => {
    Promise.all([apiRequest<any[]>('/settings'), apiRequest<any>('/audit?pageSize=100'), apiRequest<any[]>('/admin/users')])
      .then(([settings, logs, userList]) => {
        const list = Array.isArray(settings) ? settings : [];
        const mapped = Object.fromEntries(list.map((item) => [item.key, item.value]));
        setValues(mapped);
        setSavedValues(mapped);
        setAudit(Array.isArray(logs?.items) ? logs.items : []);
        setUsers(Array.isArray(userList) ? userList : []);
        setLoadError('');
      })
      .catch((err: any) => {
        setLoadError(err.message || 'Settings could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, []);

  const defaults = Object.fromEntries(active.fields.map((field) => [field.key, field.defaultValue ?? (field.type === 'boolean' ? false : '')]));
  const current = { ...defaults, ...(values[active.id] || {}) };
  const saved = savedValues[active.id] || {};
  const dirty = JSON.stringify(current) !== JSON.stringify({ ...defaults, ...saved });
  const missing = active.fields.filter((field) => field.required && (current[field.key] === '' || current[field.key] === undefined));
  const health = missing.length ? 'Attention required' : 'Healthy';
  const filteredPages = useMemo(
    () =>
      pages.filter((page) =>
        `${page.label} ${page.description} ${page.fields.map((field) => `${field.label} ${field.help}`).join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [search]
  );
  const pageAudit = audit.filter((item) => item.entity === 'Setting' && item.entityId === active.id).slice(0, 5);
  useEffect(() => { setUserPage(1); }, [userSearch, userRoleFilter, userStatusFilter]);

  const update = (key: string, value: any) => {
    setValues((all) => ({ ...all, [active.id]: { ...current, [key]: value } }));
  };

  const save = async () => {
    if (missing.length) {
      setMessage(`Complete required fields: ${missing.map((item) => item.label).join(', ')}`);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const payload = { ...current, lastUpdatedAt: new Date().toISOString() };
      await apiRequest(`/settings/${active.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const logs = await apiRequest<any>('/audit?pageSize=100');

      setValues((all) => ({ ...all, [active.id]: payload }));
      setSavedValues((all) => ({ ...all, [active.id]: payload }));
      setAudit(Array.isArray(logs?.items) ? logs.items : []);

      if (active.id === 'branding' || active.id === 'school-profile') {
        await refreshBranding();
      }

      setMessage('Configuration saved and written to the audit log.');
    } catch (err: any) {
      setMessage(err.message || 'Configuration could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const addUser = async () => {
    try {
      const created = await apiRequest<any>('/admin/users', { method: 'POST', body: JSON.stringify(newUser) });
      setUsers((current) => [created, ...current]);
      setNewUser({ name: '', email: '', role: 'TEACHER', password: '' });
      setShowAddUser(false);
      setMessage('User created successfully.');
    } catch (err: any) {
      setMessage(err.message || 'User could not be created.');
    }
  };

  const reviewRegistration = async (userId: string, status: 'APPROVED' | 'REJECTED') => {
    const reason = status === 'REJECTED' ? window.prompt('Reason for rejecting this registration:', 'Registration details could not be verified.') : undefined;
    if (status === 'REJECTED' && reason === null) return;
    try {
      const updated = await apiRequest<any>(`/admin/users/${userId}/registration`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
      setUsers((current) => current.map((item) => item.id === userId ? { ...item, ...updated, status: status === 'APPROVED' ? 'active' : 'rejected' } : item));
      setMessage(status === 'APPROVED' ? 'Registration approved.' : 'Registration rejected.');
    } catch (err: any) {
      setMessage(err.message || 'Registration review failed.');
    }
  };

  const rolePermissions: Record<string, string[]> = current.rolePermissions || defaultRolePermissions;
  const addRole = () => {
    const role = newRoleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!role || rolePermissions[role]) return setMessage('Enter a unique role name.');
    update('rolePermissions', { ...rolePermissions, [role]: [] });
    setNewRoleName('');
    setShowAddRole(false);
  };

  return (
    <DashboardLayout title="Administration Centre">
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 p-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.24em] text-blue-200">Enterprise control plane</p>
              <h2 className="mt-1 text-2xl font-bold">Administration Centre</h2>
              <p className="mt-1 text-sm text-slate-300">What is configured, what is healthy, and what needs attention without placeholder settings.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Status label="Configured" value={String(Object.keys(savedValues).length)} />
              <Status label="Status" value={loading ? 'Loading' : loadError ? 'Error' : 'Ready'} />
              <Status label="Audit" value={String(audit.length)} />
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <main className="space-y-5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsNavOpen((open) => !open)}
              aria-expanded={settingsNavOpen}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Settings2 className="h-4 w-4 text-blue-600" />
              Settings sections
              <ChevronDown className={`h-4 w-4 transition-transform ${settingsNavOpen ? 'rotate-180' : ''}`} />
            </button>
            {settingsNavOpen && (
              <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find any setting..." className={`${inputClass} pl-9`} autoFocus />
                </div>
                <nav className="max-h-[60vh] space-y-1 overflow-y-auto">
                  {filteredPages.map((page) => (
                    <button key={page.id} onClick={() => { setActiveId(page.id); setMessage(''); setSettingsNavOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold ${activeId === page.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <span>{page.label}</span>
                      {savedValues[page.id] ? <CheckCircle2 className={`h-3.5 w-3.5 ${activeId === page.id ? 'text-white' : 'text-emerald-500'}`} /> : <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Administration Centre / {active.label}</p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{active.label}</h3>
                <p className="mt-1 max-w-3xl text-sm text-gray-500">{active.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${health === 'Healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{health}</span>
                {dirty && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Unsaved changes</span>}
              </div>
            </div>

            {message && (
              <div className={`rounded-xl border p-3 text-sm ${message.includes('saved') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {message}
              </div>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between border-b border-gray-100 p-5 text-left">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Configuration</h4>
                    <p className="text-xs text-gray-500">Changes immediately affect the linked system behaviour after save.</p>
                  </div>
                </div>
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {expanded && (
                <div className="grid gap-5 p-5 md:grid-cols-2">
                  {active.fields.map((field) => (
                    <ConfigField
                      key={field.key}
                      field={field}
                      value={current[field.key]}
                      onChange={(value) => update(field.key, value)}
                      onNotice={(nextMessage) => setMessage(nextMessage)}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
                <p className="text-xs text-gray-500">{current.lastUpdatedAt ? `Last saved ${new Date(current.lastUpdatedAt).toLocaleString()}` : 'Not configured yet'}</p>
                <button disabled={!dirty || saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
                  <Save className="mr-2 inline h-4 w-4" />
                  {saving ? 'Saving...' : 'Save configuration'}
                </button>
              </div>
            </section>

            {activeId === 'users' && <UsersTable users={users} userSearch={userSearch} setUserSearch={setUserSearch} userRoleFilter={userRoleFilter} setUserRoleFilter={setUserRoleFilter} userStatusFilter={userStatusFilter} setUserStatusFilter={setUserStatusFilter} userPage={userPage} setUserPage={setUserPage} onAddUser={() => setShowAddUser(true)} onReviewRegistration={reviewRegistration} />}

            {Boolean(activeId === '__legacy-users__') && activeId === 'users' && (
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
                  <div>
                    <h4 className="text-sm font-bold">Workspace users</h4>
                    <p className="mt-1 text-xs text-gray-500">Create accounts for administrators, teachers, parents, and students.</p>
                  </div>
                  <button onClick={() => setShowAddUser(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                    <UserPlus className="mr-2 inline h-4 w-4" />Add user
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 border-b border-gray-100 bg-gray-50 p-4">
                  <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className={`${inputClass} pl-9`} placeholder="Search name or email" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} /></div>
                  <select className={`${inputClass} w-auto min-w-[150px]`} value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}><option value="ALL">All roles</option><option value="ADMIN">Administrator</option><option value="TEACHER">Teacher</option><option value="PARENT">Parent</option><option value="STUDENT">Student</option></select>
                  <select className={`${inputClass} w-auto min-w-[150px]`} value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Created</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map((item) => <tr key={item.id}><td className="px-5 py-3"><p className="text-sm font-semibold text-gray-900">{item.name || 'Unnamed user'}</p><p className="text-xs text-gray-500">{item.email}</p></td><td className="px-5 py-3 text-sm text-gray-600">{item.role}</td><td className="px-5 py-3 text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td></tr>)}
                    </tbody>
                  </table>
                  {!users.length && <p className="p-6 text-center text-sm text-gray-500">No users found.</p>}
                </div>
              </section>
            )}

            {activeId === 'roles-permissions' && (
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
                  <div><h4 className="text-sm font-bold">Role permissions</h4><p className="mt-1 text-xs text-gray-500">Choose exactly what each role can access.</p></div>
                  <button onClick={() => setShowAddRole(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><UserPlus className="mr-2 inline h-4 w-4" />Add role</button>
                </div>
                <div className="space-y-4 p-5">
                  {(Object.entries(rolePermissions) as Array<[string, string[]]>).map(([role, permissions]) => (
                    <div key={role} className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-bold text-gray-900">{role}</h5><span className="text-xs text-gray-500">{permissions.length} permissions</span></div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {permissionCatalog.map((permission) => <label key={permission} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"><input type="checkbox" checked={permissions.includes(permission)} onChange={(event) => { const next = event.target.checked ? [...permissions, permission] : permissions.filter((item: string) => item !== permission); update('rolePermissions', { ...rolePermissions, [role]: next }); }} className="h-4 w-4 accent-blue-600" />{permission}</label>)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold">Configuration health</h4>
                </div>
                {missing.length ? (
                  missing.map((field) => (
                    <div key={field.key} className="flex items-center gap-2 border-b border-gray-100 py-2 text-xs text-amber-700">
                      <AlertCircle className="h-4 w-4" />
                      {field.label} requires attention
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">All required values are configured.</div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  <h4 className="text-sm font-bold">Audit history</h4>
                </div>
                {pageAudit.length ? (
                  pageAudit.map((item) => (
                    <div key={item.id} className="border-b border-gray-100 py-2 text-xs">
                      <p className="font-semibold">Configuration updated</p>
                      <p className="text-gray-400">{new Date(item.createdAt).toLocaleString()} | {item.actorId || 'System'}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-gray-400">No changes recorded for this page yet.</p>
                )}
              </section>
            </div>

            {(activeId === 'branding' || activeId === 'school-profile') && branding?.schoolName && (
              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm font-semibold text-gray-900">Current live branding</p>
                <p className="mt-1 text-xs text-gray-500">This name and logo are used in the browser tab, system branding, and installed PWA app icon.</p>
                <div className="mt-4 flex items-center gap-3">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={`${branding.schoolName} logo`} className="h-14 w-14 rounded-xl border border-gray-200 bg-white object-contain p-2" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                      {branding.schoolName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{branding.schoolName}</p>
                    <p className="text-xs text-gray-500">{branding.schoolMotto || 'School workspace'}</p>
                  </div>
                </div>
              </section>
            )}
        </main>
        <Modal title="Add user" isOpen={showAddUser} onClose={() => setShowAddUser(false)}>
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-gray-600">Full name<input className={`${inputClass} mt-1`} value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} required /></label>
            <label className="block text-xs font-semibold text-gray-600">Email address<input type="email" className={`${inputClass} mt-1`} value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required /></label>
            <label className="block text-xs font-semibold text-gray-600">Role<select className={`${inputClass} mt-1`} value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}><option value="TEACHER">Teacher</option><option value="PARENT">Parent</option><option value="STUDENT">Student</option><option value="ADMIN">Administrator</option></select></label>
            <label className="block text-xs font-semibold text-gray-600">Temporary password<input type="password" minLength={8} className={`${inputClass} mt-1`} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required /></label>
            <button onClick={() => void addUser()} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white">Create user</button>
          </div>
        </Modal>
        <Modal title="Add role" isOpen={showAddRole} onClose={() => setShowAddRole(false)}>
          <div className="space-y-4"><label className="block text-xs font-semibold text-gray-600">Role name<input className={`${inputClass} mt-1`} value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Finance Officer" /></label><button onClick={addRole} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white">Create role</button></div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

function ConfigField({
  field,
  value,
  onChange,
  onNotice,
}: {
  field: Field;
  value: any;
  onChange: (value: any) => void;
  onNotice: (value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">{field.label}</p>
          <p className="mt-1 text-xs text-gray-500">{field.help}</p>
        </div>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-blue-600" />
      </label>
    );
  }

  if (field.type === 'image') {
    const handleFile = async (file: File | null) => {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        onNotice('Logo file is too large. Please upload an image smaller than 2MB.');
        return;
      }
      if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(file.type)) {
        onNotice('Unsupported logo format. Use PNG, SVG, JPEG or WEBP.');
        return;
      }
      onChange(await readImageAsDataUrl(file));
      onNotice('Logo ready. Save configuration to publish it across the system.');
    };

    return (
      <div className="block">
        <span className="text-xs font-bold text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </span>
        <p className="mb-2 mt-1 text-[11px] text-gray-500">{field.help}</p>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void handleFile(event.dataTransfer.files?.[0] || null);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
        >
          {value ? (
            <div className="flex flex-col items-center gap-3">
              <img src={value} alt="School logo preview" className="h-20 w-20 rounded-xl border border-gray-200 bg-white object-contain p-2" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">School logo ready</p>
                <p className="text-xs text-gray-500">Click or drop a file to replace it</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800">Upload school logo</p>
              <p className="text-xs text-gray-500">PNG, SVG, JPEG or WEBP up to 2MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.svg,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0] || null);
          }}
        />
      </div>
    );
  }

  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      <p className="mb-2 mt-1 text-[11px] text-gray-500">{field.help}</p>
      {field.type === 'select' ? (
        <select className={inputClass} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea className={inputClass} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          className={inputClass}
          type={field.type || 'text'}
          value={value ?? ''}
          onChange={(event) =>
            onChange(
              field.type === 'number'
                ? event.target.value === ''
                  ? ''
                  : Number(event.target.value)
                : event.target.value
            )
          }
        />
      )}
    </label>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2">
      <p className="text-slate-300">{label}</p>
      <p className="font-bold text-white">{value}</p>
    </div>
  );
}

function UsersTable({ users, userSearch, setUserSearch, userRoleFilter, setUserRoleFilter, userStatusFilter, setUserStatusFilter, userPage, setUserPage, onAddUser, onReviewRegistration }: { users: any[]; userSearch: string; setUserSearch: (value: string) => void; userRoleFilter: string; setUserRoleFilter: (value: string) => void; userStatusFilter: string; setUserStatusFilter: (value: string) => void; userPage: number; setUserPage: React.Dispatch<React.SetStateAction<number>>; onAddUser: () => void; onReviewRegistration: (userId: string, status: 'APPROVED' | 'REJECTED') => Promise<void> }) {
  const filtered = useMemo(() => users.filter((item) => {
    const query = userSearch.trim().toLowerCase();
    const matchesSearch = !query || `${item.name || ''} ${item.email || ''}`.toLowerCase().includes(query);
    const matchesRole = userRoleFilter === 'ALL' || item.role === userRoleFilter;
    const active = item.isActive !== false && item.status !== 'DISABLED';
    return matchesSearch && matchesRole && (userStatusFilter === 'ALL' || (userStatusFilter === 'ACTIVE' ? active : !active));
  }), [users, userSearch, userRoleFilter, userStatusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const rows = filtered.slice((userPage - 1) * 10, userPage * 10);
  const pending = users.filter((item) => item.registrationStatus === 'PENDING');
  return <section className="rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5"><div><h4 className="text-sm font-bold">Workspace users</h4><p className="mt-1 text-xs text-gray-500">Create accounts for administrators, teachers, parents, and students.</p></div><button onClick={onAddUser} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><UserPlus className="mr-2 inline h-4 w-4" />Add user</button></div>{pending.length > 0 && <div className="border-b border-amber-100 bg-amber-50 p-5"><div className="mb-3 flex items-center justify-between"><div><h5 className="font-bold text-amber-950">Pending registrations</h5><p className="text-xs text-amber-800">Review self-registered accounts before they can sign in.</p></div><span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">{pending.length} awaiting review</span></div><div className="space-y-2">{pending.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"><div><p className="text-sm font-bold text-gray-900">{item.name || 'Unnamed user'}</p><p className="text-xs text-gray-500">{item.email} · {item.role}</p><p className="text-xs text-gray-400">Registered {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</p></div><div className="flex gap-2"><button onClick={() => void onReviewRegistration(item.id, 'REJECTED')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button><button onClick={() => void onReviewRegistration(item.id, 'APPROVED')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button></div></div>)}</div></div>}<div className="flex flex-nowrap items-center gap-3 overflow-x-auto border-b border-gray-100 bg-gray-50 p-4"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className={`${inputClass} pl-9`} placeholder="Search name or email" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} /></div><select className={`${inputClass} w-44 min-w-[11rem] shrink-0`} value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}><option value="ALL">All roles</option><option value="ADMIN">Administrator</option><option value="TEACHER">Teacher</option><option value="PARENT">Parent</option><option value="STUDENT">Student</option></select><select className={`${inputClass} w-44 min-w-[11rem] shrink-0`} value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y divide-gray-100">{rows.map((item) => { const active = item.isActive !== false && item.status !== 'DISABLED'; return <tr key={item.id}><td className="px-5 py-3"><p className="text-sm font-semibold text-gray-900">{item.name || 'Unnamed user'}</p><p className="text-xs text-gray-500">{item.email}</p></td><td className="px-5 py-3 text-sm text-gray-600">{item.role}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{active ? 'Active' : 'Disabled'}</span></td><td className="px-5 py-3 text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td></tr>; })}</tbody></table>{!filtered.length && <p className="p-6 text-center text-sm text-gray-500">No users match the current search and filters.</p>}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 text-xs text-gray-500"><span>{filtered.length ? `${(userPage - 1) * 10 + 1}-${Math.min(userPage * 10, filtered.length)} of ${filtered.length} users` : '0 users'} · Showing 10 rows per page</span><div className="flex items-center gap-2"><button disabled={userPage <= 1} onClick={() => setUserPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button><span>Page {Math.min(userPage, pageCount)} of {pageCount}</span><button disabled={userPage >= pageCount} onClick={() => setUserPage((page) => Math.min(pageCount, page + 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button></div></div></section>;
}
