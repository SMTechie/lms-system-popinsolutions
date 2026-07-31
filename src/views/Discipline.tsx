import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Gavel, Plus, ShieldAlert } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import Modal from "../components/Modal";
import PortalLoader from "../components/PortalLoader";
import { apiRequest } from "../lib/api";
import { notifyAction } from "../lib/notify";

const defaultForm = {
  learnerId: "",
  title: "",
  category: "Conduct",
  severity: "MEDIUM",
  status: "OPEN",
  description: "",
  actionTaken: "",
  points: 2,
  parentVisible: true,
  requiresAcknowledgement: true,
  followUpAt: "",
};

export default function Discipline() {
  const [records, setRecords] = useState<any[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<any>("/students/discipline");
      setRecords(Array.isArray(response?.items) ? response.items : []);
      setLearners(Array.isArray(response?.learners) ? response.learners : []);
      setStats(response?.stats || {});
    } catch (error: any) {
      notifyAction(error.message || "Could not load discipline records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleRecords = useMemo(() => {
    if (selectedStatus === "ALL") return records;
    return records.filter((item) => item.status === selectedStatus);
  }, [records, selectedStatus]);

  const save = async () => {
    try {
      await apiRequest(`/students/${form.learnerId}/discipline`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          points: Number(form.points || 0),
          followUpAt: form.followUpAt || undefined,
        }),
      });
      setForm(defaultForm);
      setShowCreate(false);
      await load();
      notifyAction("Disciplinary record added", "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not save disciplinary record", "error");
    }
  };

  const updateStatus = async (recordId: string, status: string) => {
    try {
      await apiRequest(`/students/discipline/${recordId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      notifyAction("Disciplinary status updated", "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not update disciplinary record", "error");
    }
  };

  return (
    <DashboardLayout title="Disciplinary Module">
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-rose-700 to-orange-600 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-100">School conduct</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Disciplinary Module</h1>
              <p className="mt-1 text-sm text-rose-100">
                Track incidents, consequences, follow-ups, and parent acknowledgement in one place.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-700"
            >
              <Plus className="mr-2 inline h-4 w-4" />
              New record
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={ShieldAlert} label="Open cases" value={stats.open || 0} />
          <Metric icon={Gavel} label="Resolved cases" value={stats.resolved || 0} />
          <Metric icon={AlertTriangle} label="Awaiting parent ack" value={stats.awaitingAcknowledgement || 0} />
          <Metric icon={CheckCircle2} label="High severity" value={stats.highSeverity || 0} />
        </div>

        {loading && <PortalLoader label="Loading disciplinary records..." />}

        {!loading && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="flex flex-wrap gap-2">
              {["ALL", "OPEN", "IN_REVIEW", "RESOLVED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    selectedStatus === status ? "bg-rose-600 text-white" : "border text-gray-600"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Learner</th>
                  <th>Incident</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Parent</th>
                  <th className="pr-5">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id} className="border-t">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{record.learnerName}</p>
                      <p className="text-xs text-gray-500">{record.studentNumber}</p>
                    </td>
                    <td>
                      <p className="font-medium text-gray-900">{record.title}</p>
                      <p className="text-xs text-gray-500">{record.category}</p>
                    </td>
                    <td>
                      <SeverityPill severity={record.severity} />
                    </td>
                    <td>{record.status}</td>
                    <td>
                      <p className="text-xs text-gray-600">
                        {record.parentVisible ? "Visible" : "Internal only"}
                        {record.requiresAcknowledgement ? ` · ${record.parentAcknowledgedAt ? "Acknowledged" : "Awaiting ack"}` : ""}
                      </p>
                    </td>
                    <td className="pr-5">
                      <div className="flex flex-wrap gap-2">
                        {record.status !== "IN_REVIEW" && (
                          <button
                            onClick={() => void updateStatus(record.id, "IN_REVIEW")}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700"
                          >
                            Review
                          </button>
                        )}
                        {record.status !== "RESOLVED" && (
                          <button
                            onClick={() => void updateStatus(record.id, "RESOLVED")}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRecords.length && <p className="p-10 text-center text-sm text-gray-500">No disciplinary records yet.</p>}
          </div>
        </div>
        )}
      </div>

      <Modal title="New disciplinary record" isOpen={showCreate} onClose={() => setShowCreate(false)} wide>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Learner">
            <select className={inputClass} value={form.learnerId} onChange={(e) => setForm({ ...form, learnerId: e.target.value })}>
              <option value="">Select learner</option>
              {learners.map((learner: any) => (
                <option key={learner.id} value={learner.id}>
                  {learner.firstName} {learner.lastName} · {learner.studentNumber}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Incident title">
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["Conduct", "Attendance", "Bullying", "Academic dishonesty", "Uniform", "Property damage"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select className={inputClass} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Demerit points">
            <input
              type="number"
              className={inputClass}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
            />
          </Field>
          <Field label="Follow-up date">
            <input
              type="date"
              className={inputClass}
              value={form.followUpAt}
              onChange={(e) => setForm({ ...form, followUpAt: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Action taken">
            <textarea className={inputClass} value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.parentVisible}
              onChange={(e) => setForm({ ...form, parentVisible: e.target.checked })}
            />
            Visible to parents
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresAcknowledgement}
              onChange={(e) => setForm({ ...form, requiresAcknowledgement: e.target.checked })}
            />
            Require parent acknowledgement
          </label>
        </div>
        <button onClick={() => void save()} className="mt-5 w-full rounded-lg bg-rose-600 py-3 text-sm font-bold text-white">
          Save disciplinary record
        </button>
      </Modal>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-rose-600" />
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const color =
    severity === "CRITICAL"
      ? "bg-red-100 text-red-700"
      : severity === "HIGH"
        ? "bg-orange-100 text-orange-700"
        : severity === "MEDIUM"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${color}`}>{severity}</span>;
}

const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
