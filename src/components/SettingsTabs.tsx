import React, { useEffect, useRef, useState } from 'react';
import { Save, RefreshCw, KeyRound, ShieldCheck, ExternalLink, Send } from 'lucide-react';
import { notifyAction } from '../lib/notify';
import { useBranding } from '../settings/BrandingContext';
import { apiRequest } from '../lib/api';
import { toRgbChannels } from '../lib/brand';

const tabs = [
  'Users', 'Roles & Permissions', 'Branding', 'Email Config',
  'IMAP Config', 'Licensing', 'Modules', 'Workflow Rules',
  'Automation', 'Payments', 'Banking', 'Portal', 'PWA', 'Integrations',
];

interface ToggleSwitchProps {
  label: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}

function ToggleSwitch({ label, description, defaultChecked = false, checked: controlled, onChange }: ToggleSwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);
  const isChecked = controlled !== undefined ? controlled : checked;
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={isChecked}
        onClick={() => {
          const next = !isChecked;
          if (controlled === undefined) setChecked(next);
          onChange?.(next);
        }}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isChecked ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isChecked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function FormField({
  label,
  type = 'text',
  placeholder = '',
  defaultValue = '',
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const isControlled = value !== undefined;
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={!isControlled ? defaultValue : undefined}
        value={isControlled ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200 bg-white"
      />
    </div>
  );
}

export default function SettingsTabs() {
  const { branding, setBrandingLocal } = useBranding();
  const [activeTab, setActiveTab] = useState('Branding');
  const [saving, setSaving] = useState(false);
  const [loadingIntegration, setLoadingIntegration] = useState(false);
  const [integrationForm, setIntegrationForm] = useState<any | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<any | null>(null);
  const [generatedSecrets, setGeneratedSecrets] = useState<{ apiKey?: string; apiSecret?: string; webhookSecret?: string }>({});
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [customHeadersText, setCustomHeadersText] = useState("");
  const [retryPolicyText, setRetryPolicyText] = useState("");
  const [brandingForm, setBrandingForm] = useState({
    schoolName: branding?.schoolName || 'Your School',
    schoolMotto: branding?.schoolMotto || 'Excellence in Education',
    primaryColor: branding?.primaryColor || '#1E3A8A',
    accentColor: branding?.accentColor || '#3B82F6',
    logoUrl: branding?.logoUrl || '',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const schoolName = brandingForm.schoolName || "Your School";

  React.useEffect(() => {
    if (!branding) return;
    setBrandingForm({
      schoolName: branding.schoolName || 'Your School',
      schoolMotto: branding.schoolMotto || 'Excellence in Education',
      primaryColor: branding.primaryColor || '#1E3A8A',
      accentColor: branding.accentColor || '#3B82F6',
      logoUrl: branding.logoUrl || '',
    });
  }, [branding]);

  useEffect(() => {
    if (activeTab !== 'Integrations') return;
    let mounted = true;
    setLoadingIntegration(true);
    Promise.all([apiRequest('/integrations/marketing'), apiRequest('/integrations/marketing/status')])
      .then(([integration, status]) => {
        if (!mounted) return;
        setIntegrationForm(integration);
        setIntegrationStatus(status);
        setCustomHeadersText(integration.customHeaders ? JSON.stringify(integration.customHeaders, null, 2) : "");
        setRetryPolicyText(integration.retryPolicy ? JSON.stringify(integration.retryPolicy, null, 2) : "");
      })
      .catch((err) => notifyAction(err.message || 'Failed to load integration settings.', 'error'))
      .finally(() => mounted && setLoadingIntegration(false));
    return () => {
      mounted = false;
    };
  }, [activeTab]);

  const handleLogoSelect = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifyAction("Logo must be under 2MB.", "warning");
      return;
    }
    const allowed = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      notifyAction("Supported formats: PNG, SVG, JPEG, WEBP.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setBrandingForm((prev) => ({ ...prev, logoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const previewColors = (primary: string, accent: string) => {
    const root = document.documentElement;
    const primaryRgb = toRgbChannels(primary);
    const accentRgb = toRgbChannels(accent);
    if (primaryRgb) root.style.setProperty("--brand-primary", primaryRgb);
    if (accentRgb) root.style.setProperty("--brand-accent", accentRgb);
  };

  const saveBranding = async () => {
    try {
      setSaving(true);
      const payload = {
        schoolName: brandingForm.schoolName,
        schoolMotto: brandingForm.schoolMotto,
        primaryColor: brandingForm.primaryColor,
        accentColor: brandingForm.accentColor,
        logoUrl: brandingForm.logoUrl || undefined,
      };
      await apiRequest(`/settings/branding`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setBrandingLocal(payload);
      notifyAction("Settings saved.", "success");
    } catch (err: any) {
      notifyAction(err?.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveIntegration = async () => {
    if (!integrationForm) return;
    try {
      setSaving(true);
      let customHeaders = integrationForm.customHeaders;
      let retryPolicy = integrationForm.retryPolicy;
      if (customHeadersText) {
        customHeaders = JSON.parse(customHeadersText);
      }
      if (retryPolicyText) {
        retryPolicy = JSON.parse(retryPolicyText);
      }
      await apiRequest(`/integrations/marketing`, {
        method: 'PUT',
        body: JSON.stringify({ ...integrationForm, customHeaders, retryPolicy }),
      });
      notifyAction('Integration settings saved.', 'success');
    } catch (err: any) {
      notifyAction(err?.message || 'Failed to save integration settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (path: string, key: 'apiKey' | 'apiSecret' | 'webhookSecret') => {
    try {
      const res = await apiRequest(`/integrations/marketing/${path}`, { method: 'POST' });
      setGeneratedSecrets((prev) => ({ ...prev, [key]: res[key] }));
      notifyAction(`${key} generated. Copy it now.`, 'success');
    } catch (err: any) {
      notifyAction(err?.message || 'Failed to generate secret.', 'error');
    }
  };

  const handleTestConnection = async () => {
    try {
      const res = await apiRequest(`/integrations/marketing/test-connection`, { method: 'POST' });
      if (res.ok) notifyAction('Connection successful.', 'success');
      else notifyAction(`Connection failed (status ${res.status}).`, 'warning');
    } catch (err: any) {
      notifyAction(err?.message || 'Connection failed.', 'error');
    }
  };

  const handleSendTestWebhook = async () => {
    try {
      await apiRequest(`/integrations/marketing/send-test-webhook`, { method: 'POST' });
      notifyAction('Test webhook queued.', 'success');
    } catch (err: any) {
      notifyAction(err?.message || 'Webhook failed.', 'error');
    }
  };

  const tabContent: Record<string, React.ReactNode> = {
    'Email Config': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="SMTP Host" placeholder="smtp.gmail.com" />
          <FormField label="SMTP Port" placeholder="587" />
          <FormField label="Username" placeholder="noreply@school.edu" />
          <FormField label="Password" type="password" placeholder="••••••••" />
          <FormField label="From Name" defaultValue={schoolName} />
          <FormField label="From Email" defaultValue="noreply@school.edu" />
        </div>
        <div className="space-y-1">
          <ToggleSwitch label="Enable TLS/SSL" defaultChecked={true} />
          <ToggleSwitch label="Email Notifications" defaultChecked={true} />
        </div>
      </div>
    ),
    'Modules': (
      <div className="space-y-1">
        {['Boards & Workflows', 'Requisitions', 'Supply Chain', 'Inventory Management', 'Uniform Store', 'Ticketing System', 'Admissions', 'Analytics', 'Parent Portal', 'PWA Notifications'].map((mod, i) => (
          <ToggleSwitch key={mod} label={mod} defaultChecked={i < 7} />
        ))}
      </div>
    ),
    'Payments': (
      <div className="space-y-6">
        <div className="space-y-1">
          <ToggleSwitch label="PayFast" description="Accept card payments via PayFast" defaultChecked={true} />
          <ToggleSwitch label="Ozow" description="Accept instant EFT via Ozow" defaultChecked={true} />
          <ToggleSwitch label="Manual EFT" description="Allow manual bank transfer payments" defaultChecked={true} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="PayFast Merchant ID" placeholder="10000100" />
          <FormField label="PayFast Merchant Key" placeholder="46f0cd694581a" />
          <FormField label="Ozow Site Code" placeholder="TST-TST-001" />
          <FormField label="Ozow Private Key" placeholder="••••••••••••" />
        </div>
      </div>
    ),
    'Banking': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Bank Name" defaultValue="First National Bank" />
          <FormField label="Account Name" defaultValue={schoolName} />
          <FormField label="Account Number" defaultValue="62012345678" />
          <FormField label="Branch Code" defaultValue="250655" />
          <FormField label="Account Type" defaultValue="Current Account" />
          <FormField label="Reference Format" defaultValue="FEES-{STUDENT_ID}" />
        </div>
      </div>
    ),
    'Integrations': (
      <div className="space-y-6">
        {loadingIntegration && <p className="text-sm text-gray-500">Loading integration settings...</p>}
        {integrationForm && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Marketing Website</h3>
                    <p className="text-xs text-gray-500">Configure API and webhook sync for the school website.</p>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Test Connection
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Website Base URL"
                    value={integrationForm.websiteBaseUrl || ''}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, websiteBaseUrl: value }))}
                  />
                  <FormField
                    label="Webhook Target URL"
                    value={integrationForm.webhookTargetUrl || ''}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, webhookTargetUrl: value }))}
                  />
                  <FormField
                    label="Public Apply Base URL"
                    value={integrationForm.publicApplyBaseUrl || ''}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, publicApplyBaseUrl: value }))}
                  />
                  <FormField
                    label="Catalog Endpoint"
                    value={integrationForm.catalogEndpoint || ''}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, catalogEndpoint: value }))}
                  />
                  <FormField
                    label="Callback Endpoint"
                    value={integrationForm.callbackEndpoint || ''}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, callbackEndpoint: value }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    label="Default Sync Mode"
                    value={integrationForm.syncMode || 'api_pull'}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, syncMode: value }))}
                  />
                  <FormField
                    label="Default Visibility"
                    value={integrationForm.defaultCatalogVisibility || 'universal'}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, defaultCatalogVisibility: value }))}
                  />
                  <FormField
                    label="Environment"
                    value={integrationForm.environment || 'development'}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, environment: value }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Request Signing Mode"
                    value={integrationForm.requestSigningMode || 'hmac'}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, requestSigningMode: value }))}
                  />
                  <FormField
                    label="Request Timeout (seconds)"
                    type="number"
                    value={String(integrationForm.requestTimeoutSeconds || 15)}
                    onChange={(value) =>
                      setIntegrationForm((prev: any) => ({ ...prev, requestTimeoutSeconds: Number(value) }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Custom Headers (JSON)</label>
                    <textarea
                      value={customHeadersText}
                      onChange={(e) => setCustomHeadersText(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-mono"
                      rows={5}
                      placeholder='{\"X-Source\": \"popin\"}'
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Retry Policy (JSON)</label>
                    <textarea
                      value={retryPolicyText}
                      onChange={(e) => setRetryPolicyText(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-mono"
                      rows={5}
                      placeholder='{\"attempts\": 5, \"delays\": [60, 300, 900]}'
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <ToggleSwitch
                    label="Enable Store Catalog API"
                    checked={integrationForm.shopApiEnabled}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, shopApiEnabled: value }))}
                  />
                  <ToggleSwitch
                    label="Enable Store Webhooks"
                    checked={integrationForm.webhookEnabled}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, webhookEnabled: value }))}
                  />
                  <ToggleSwitch
                    label="Enable Application Form API"
                    checked={integrationForm.applicationFormApiEnabled}
                    onChange={(value) => setIntegrationForm((prev: any) => ({ ...prev, applicationFormApiEnabled: value }))}
                  />
                </div>

                <button
                  onClick={handleSendTestWebhook}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-white"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Test Webhook
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">Credentials</h4>
                <p className="text-xs text-gray-500">Keys are displayed once when generated.</p>

                <div className="space-y-2">
                  <button
                    onClick={() => handleGenerate('api-key/generate', 'apiKey')}
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Generate API Key
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleGenerate('api-key/rotate', 'apiKey')}
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Rotate API Key
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleGenerate('api-secret/generate', 'apiSecret')}
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Generate API Secret
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleGenerate('api-secret/rotate', 'apiSecret')}
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Rotate API Secret
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleGenerate('webhook-secret/generate', 'webhookSecret')}
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Generate Webhook Secret
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleGenerate('webhook-secret/rotate', 'webhookSecret')}
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Rotate Webhook Secret
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(generatedSecrets.apiKey || generatedSecrets.apiSecret || generatedSecrets.webhookSecret) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    <p className="font-semibold mb-1">Copy these secrets now:</p>
                    {generatedSecrets.apiKey && <p>API Key: {generatedSecrets.apiKey}</p>}
                    {generatedSecrets.apiSecret && <p>API Secret: {generatedSecrets.apiSecret}</p>}
                    {generatedSecrets.webhookSecret && <p>Webhook Secret: {generatedSecrets.webhookSecret}</p>}
                  </div>
                )}
              </div>
            </div>

            {integrationStatus && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-gray-600">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-400">Last API Request</p>
                  <p className="font-semibold text-gray-800">{integrationStatus.lastApi?.createdAt || '—'}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-400">Last Catalog Sync</p>
                  <p className="font-semibold text-gray-800">{integrationForm.lastCatalogSyncAt || '—'}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-400">Last Webhook</p>
                  <p className="font-semibold text-gray-800">{integrationStatus.lastWebhook?.createdAt || '—'}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-400">Webhook Failures</p>
                  <p className="font-semibold text-gray-800">{integrationStatus.webhookFailureCount ?? 0}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tab list */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "Branding" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="School Name"
                value={brandingForm.schoolName}
                onChange={(value) => setBrandingForm((prev) => ({ ...prev, schoolName: value }))}
              />
              <FormField
                label="School Motto"
                value={brandingForm.schoolMotto}
                onChange={(value) => setBrandingForm((prev) => ({ ...prev, schoolMotto: value }))}
              />
              <FormField
                label="Primary Color"
                type="color"
                value={brandingForm.primaryColor}
                onChange={(value) =>
                  setBrandingForm((prev) => {
                    const next = { ...prev, primaryColor: value };
                    previewColors(next.primaryColor, next.accentColor);
                    return next;
                  })
                }
              />
              <FormField
                label="Accent Color"
                type="color"
                value={brandingForm.accentColor}
                onChange={(value) =>
                  setBrandingForm((prev) => {
                    const next = { ...prev, accentColor: value };
                    previewColors(next.primaryColor, next.accentColor);
                    return next;
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Logo Upload</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setLogoDragActive(true);
                }}
                onDragLeave={() => setLogoDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setLogoDragActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) handleLogoSelect(file);
                }}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  logoDragActive ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {brandingForm.logoUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={brandingForm.logoUrl}
                      alt="School logo preview"
                      className="h-16 w-16 rounded-xl object-contain bg-gray-50 border border-gray-200 p-2"
                    />
                    <p className="text-xs text-gray-500">Click to replace logo</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      Drop logo here or <span className="text-blue-600">browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, SVG up to 2MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.svg,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoSelect(file);
                }}
              />
            </div>
          </div>
        ) : tabContent[activeTab] || (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Configuration Field 1" placeholder="Enter value..." />
              <FormField label="Configuration Field 2" placeholder="Enter value..." />
            </div>
            <div className="space-y-1">
              <ToggleSwitch label="Enable Feature" defaultChecked={true} />
              <ToggleSwitch label="Advanced Mode" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
          <button
            onClick={activeTab === 'Integrations' ? saveIntegration : saveBranding}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={() => notifyAction("Changes discarded.", "warning")}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
