import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ClipboardList, Eye } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { apiRequest } from '../lib/api';
import { notifyAction } from '../lib/notify';

export default function Admissions() {
  const [search, setSearch] = useState('');
  const [forms, setForms] = useState<any[]>([]);
  const [activeForm, setActiveForm] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const publicFormHref = activeForm?.id
    ? `/applications/new?formId=${encodeURIComponent(activeForm.id)}`
    : '/applications/new';

  useEffect(() => {
    apiRequest<any>('/applications/forms')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setForms(list);
        if (list.length) setActiveForm(list[0]);
      })
      .catch((err) => notifyAction(err.message || 'Failed to load admissions forms', 'error'));
  }, []);

  useEffect(() => {
    if (!activeForm?.id) return;
    apiRequest<any>(`/applications/forms/${activeForm.id}/submissions`)
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch((err) => notifyAction(err.message || 'Failed to load submissions', 'error'));
  }, [activeForm?.id]);

  const filtered = useMemo(() => {
    return submissions.filter((submission) => {
      const match = `${submission.submissionReference || ''} ${submission.applicantName || ''} ${submission.guardianName || ''}`.toLowerCase();
      return match.includes(search.toLowerCase());
    });
  }, [submissions, search]);

  return (
    <DashboardLayout title="Admissions">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Admissions</h2>
            <p className="text-sm text-gray-500">Track applications and manage your admissions form.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admissions/form-builder"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              <ClipboardList className="w-4 h-4" />
              Form Builder
            </Link>
            <a
              href={publicFormHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              <Eye className="w-4 h-4" />
              Open Public Form
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Submissions</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{submissions.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Admissions Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{activeForm?.admissionsOpenState || 'Unknown'}</p>
            <p className="text-xs text-gray-400 mt-1">{activeForm?.openingMessage || 'Managed in builder'}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Latest Submission</p>
            <p className="text-sm text-gray-700 mt-1">
              {submissions[0]?.submittedAt ? new Date(submissions[0].submittedAt).toLocaleDateString() : 'No submissions'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search submissions..."
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
          {forms.length > 1 && (
            <select
              value={activeForm?.id || ''}
              onChange={(e) => setActiveForm(forms.find((form) => form.id === e.target.value))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {forms.map((form) => (
                <option key={form.id} value={form.id}>{form.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
              <tr>
                {['Reference', 'Applicant', 'Guardian', 'Submitted', 'Status', 'Channel'].map((header) => (
                  <th key={header} className="text-left px-4 py-3 font-semibold uppercase tracking-wide">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{submission.submissionReference}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{submission.applicantName || 'Applicant'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{submission.guardianName || 'Guardian'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                      <CheckCircle className="w-3 h-3" />
                      {submission.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{submission.submissionChannel || 'website'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">No submissions found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
