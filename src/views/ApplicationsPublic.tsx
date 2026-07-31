import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

type FormField = {
  id?: string;
  type: string;
  key: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  fileTypes?: string;
  maxSizeMb?: number;
};

type FormStep = {
  title: string;
  fields: FormField[];
};

type FormSchema = {
  title: string;
  description?: string;
  steps: FormStep[];
};

const findValue = (payload: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (payload[key]) return payload[key];
  }
  return '';
};

const joinValues = (payload: Record<string, any>, keys: string[]) =>
  keys
    .map((key) => String(payload[key] || '').trim())
    .filter(Boolean)
    .join(' ');

export default function ApplicationsPublic() {
  const [params] = useSearchParams();
  const token = params.get('token') || undefined;
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormSchema | null>(null);
  const [status, setStatus] = useState<any | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, { name: string; mimeType: string; base64: string }>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const query = token ? `?token=${token}` : '';
    apiRequest<any>(`/applications/new${query}`, { auth: false })
      .then((data) => {
        setStatus(data);
        setForm(data.form?.schemaJson || null);
      })
      .catch((err) => notifyAction(err.message || 'Unable to load application form', 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  const steps = form?.steps || [];
  const activeStep = steps[currentStep];

  const updateValue = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (field: FormField, file: File | null) => {
    if (!file) return;
    const maxSize = (field.maxSizeMb || 5) * 1024 * 1024;
    if (file.size > maxSize) {
      notifyAction(`File too large for ${field.label || field.key}`, 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1] || '';
      setFiles((prev) => ({
        ...prev,
        [field.key]: {
          name: file.name,
          mimeType: file.type,
          base64
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (fieldsToValidate: FormField[]) => {
    for (const field of fieldsToValidate) {
      const value = values[field.key];
      const isMissingFile = field.type === 'file' && !files[field.key];
      const isMissingCheckbox = field.type === 'checkbox' && value !== true;
      const isMissingArray = field.type === 'checkbox_group' && (!Array.isArray(value) || value.length === 0);
      const isEmptyValue =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      if (isMissingFile || isMissingCheckbox || isMissingArray || isEmptyValue) {
        notifyAction('Please complete all required fields.', 'warning');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!form) return;
    const fieldsToValidate =
      currentStep < steps.length - 1
        ? activeStep?.fields?.filter((field) => field.required) || []
        : steps.flatMap((step) => step.fields.filter((field) => field.required));
    if (!validateStep(fieldsToValidate)) return;
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    try {
      const applicantName =
        findValue(values, ['student_name', 'learner_name', 'applicant_name', 'studentName']) ||
        joinValues(values, ['student_first_name', 'student_middle_name', 'student_last_name']);
      const guardianName =
        findValue(values, ['guardian_name', 'parent_name', 'guardianName']) ||
        joinValues(values, ['guardian_first_name', 'guardian_last_name']);
      const guardianEmail = findValue(values, ['guardian_email', 'parent_email', 'guardianEmail']);
      const guardianPhone =
        findValue(values, ['guardian_phone', 'parent_phone', 'guardianPhone']) ||
        findValue(values, ['guardian_mobile', 'guardian_alt_phone']);

      if (!guardianEmail) {
        notifyAction('Guardian email is required.', 'warning');
        return;
      }

      setSubmitting(true);

      const filesPayload = Object.entries(files).map(([fieldKey, file]) => ({
        fieldKey,
        originalFilename: file.name,
        mimeType: file.mimeType,
        contentBase64: file.base64
      }));

      await apiRequest('/applications/new', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          applicantName: applicantName || 'Applicant',
          guardianName: guardianName || 'Guardian',
          guardianEmail,
          guardianPhone,
          submissionChannel: 'website',
          payload: values,
          files: filesPayload,
          token
        })
      });

      notifyAction('Application submitted successfully.', 'success');
      setValues({});
      setFiles({});
      setCurrentStep(0);
    } catch (err: any) {
      notifyAction(err?.message || 'Failed to submit application.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading application form...
      </div>
    );
  }

  if (!status?.admissionsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-lg bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admissions Closed</h1>
          <p className="text-sm text-gray-600">
            {status?.closedMessage || 'Admissions are currently closed. Please check back later.'}
          </p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        Application form not available.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{form.title}</h1>
          {form.description && <p className="text-sm text-gray-500 mt-2">{form.description}</p>}
        </div>

        {steps.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
            Step {currentStep + 1} of {steps.length}: {activeStep?.title}
          </div>
        )}

        <div className="space-y-4">
          {activeStep?.fields?.map((field) => {
            if (field.type === 'section') {
              return <h2 key={field.key} className="text-lg font-semibold text-gray-900 mt-6">{field.label}</h2>;
            }
            if (field.type === 'paragraph') {
              return <p key={field.key} className="text-sm text-gray-500">{field.label}</p>;
            }
            if (field.type === 'divider') {
              return <hr key={field.key} className="border-gray-200" />;
            }
            if (field.type === 'page_break') {
              return null;
            }

            const commonProps = {
              id: field.key,
              name: field.key,
              value: values[field.key] || '',
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                updateValue(field.key, e.target.value),
              className: 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg'
            };

            return (
              <div key={field.key}>
                {field.label && (
                  <label htmlFor={field.key} className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                  </label>
                )}
                {field.type === 'textarea' && (
                  <textarea {...commonProps} rows={4} placeholder={field.placeholder} />
                )}
                {field.type === 'select' && (
                  <select {...commonProps}>
                    <option value="">Select...</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}
                {field.type === 'radio' && (
                  <div className="space-y-2">
                    {(field.options || []).map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="radio"
                          name={field.key}
                          value={option}
                          checked={values[field.key] === option}
                          onChange={() => updateValue(field.key, option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
                {field.type === 'checkbox_group' && (
                  <div className="space-y-2">
                    {(field.options || []).map((option) => {
                      const current = values[field.key] || [];
                      const checked = current.includes(option);
                      return (
                        <label key={option} className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? current.filter((item: string) => item !== option)
                                : [...current, option];
                              updateValue(field.key, next);
                            }}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                )}
                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={!!values[field.key]}
                      onChange={(e) => updateValue(field.key, e.target.checked)}
                    />
                    {field.placeholder || 'Yes'}
                  </label>
                )}
                {field.type === 'file' && (
                  <input
                    type="file"
                    accept={field.fileTypes || undefined}
                    onChange={(e) => handleFileChange(field, e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                )}
                {['text', 'email', 'phone', 'number', 'date'].includes(field.type) && (
                  <input
                    {...commonProps}
                    type={field.type === 'phone' ? 'tel' : field.type}
                    placeholder={field.placeholder}
                  />
                )}
                {field.helpText && <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"
          >
            {currentStep < steps.length - 1 ? 'Next' : submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
