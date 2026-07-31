import React, { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRightLeft, Download, GraduationCap, Link2, Plus, Search, Upload, UserRound, Users } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import Modal from "../components/Modal";
import { apiRequest } from "../lib/api";
import { notifyAction } from "../lib/notify";

const emptyStudent = {
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  identityNumber: "",
  gender: "",
  email: "",
  phone: "",
  studentNumber: "",
  gradeId: "",
  classId: "",
  medicalNotes: "",
};

const permissionKeys = [
  "viewFees",
  "payFees",
  "viewReports",
  "viewHomework",
  "receiveAnnouncements",
  "messageTeachers",
  "authorisePickup",
  "submitApplications",
  "bookAppointments",
  "viewHostel",
  "applyHostel",
  "viewHostelBilling",
  "submitHostelConcerns",
  "viewHostelMovement",
];

export default function Students() {
  const [data, setData] = useState<any>({ items: [], grades: [], classes: [], subjects: [] });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  const [teacher, setTeacher] = useState({ name: "", email: "", temporaryPassword: "" });
  const [showAcademic, setShowAcademic] = useState(false);
  const [academic, setAcademic] = useState<any>({ type: "grade", name: "", code: "", gradeId: "", room: "" });
  const [guardian, setGuardian] = useState<any>({
    email: "",
    name: "",
    relationshipType: "Guardian",
    isPrimary: true,
    ...Object.fromEntries(permissionKeys.map((key) => [key, true])),
  });
  const [move, setMove] = useState({ gradeId: "", classId: "", reason: "Class transfer" });

  const load = async () => {
    try {
      const result = await apiRequest(`/students?status=${status}&search=${encodeURIComponent(search)}`);
      setData({
        items: Array.isArray(result?.items) ? result.items : [],
        grades: Array.isArray(result?.grades) ? result.grades : [],
        classes: Array.isArray(result?.classes) ? result.classes : [],
        subjects: Array.isArray(result?.subjects) ? result.subjects : [],
      });
    } catch (error: any) {
      notifyAction(error.message || "Could not load students", "error");
      setData({ items: [], grades: [], classes: [], subjects: [] });
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const grades = Array.isArray(data?.grades) ? data.grades : [];
  const classes = Array.isArray(data?.classes) ? data.classes : [];
  const subjects = Array.isArray(data?.subjects) ? data.subjects : [];

  const filteredClasses = useMemo(
    () => classes.filter((item: any) => !editing?.gradeId || item.gradeId === editing.gradeId),
    [classes, editing?.gradeId],
  );

  const save = async () => {
    try {
      const body = {
        ...editing,
        classId: editing.classId || undefined,
        gradeId: editing.gradeId || undefined,
        dateOfBirth: editing.dateOfBirth || undefined,
        identityNumber: editing.identityNumber || undefined,
        email: editing.email || undefined,
      };
      const result = await apiRequest(editing.id ? `/students/${editing.id}` : "/students", {
        method: editing.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setShowEditor(false);
      setSelected(result);
      await load();
      notifyAction(editing.id ? "Student updated" : "Student created", "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not save student", "error");
    }
  };

  const linkGuardian = async () => {
    try {
      await apiRequest(`/students/${selected.id}/guardians`, { method: "POST", body: JSON.stringify(guardian) });
      setShowGuardian(false);
      setSelected(await apiRequest(`/students/${selected.id}`));
      await load();
      notifyAction("Guardian linked and audited", "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not link guardian", "error");
    }
  };

  const transfer = async () => {
    try {
      await apiRequest(`/students/${selected.id}/move`, {
        method: "POST",
        body: JSON.stringify({ ...move, classId: move.classId || undefined, gradeId: move.gradeId || undefined }),
      });
      setShowMove(false);
      setSelected(await apiRequest(`/students/${selected.id}`));
      await load();
      notifyAction("Placement updated", "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not move student", "error");
    }
  };

  const archive = async () => {
    if (!selected || !confirm(`Archive ${selected.firstName} ${selected.lastName}?`)) return;
    await apiRequest(`/students/${selected.id}/archive`, { method: "PATCH" });
    setSelected(null);
    await load();
    notifyAction("Student archived", "success");
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    const [header, ...rows] = (await file.text())
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(",").map((cell) => cell.trim()));
    const students = rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] || undefined])));
    try {
      const result: any = await apiRequest("/students/import", { method: "POST", body: JSON.stringify({ students }) });
      await load();
      notifyAction(`Imported ${result.created}; rejected ${result.rejected}`, result.rejected ? "warning" : "success");
    } catch (error: any) {
      notifyAction(error.message || "Import failed", "error");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["studentNumber", "firstName", "lastName", "dateOfBirth", "identityNumber", "gradeId", "classId"],
      ...items.map((student: any) => [
        student.studentNumber,
        student.firstName,
        student.lastName,
        student.dateOfBirth || "",
        student.identityNumber || "",
        student.gradeId || "",
        student.classId || "",
      ]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((row: any[]) => row.join(",")).join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "students.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const createTeacher = async () => {
    try {
      await apiRequest("/students/teachers", {
        method: "POST",
        body: JSON.stringify({ ...teacher, temporaryPassword: teacher.temporaryPassword || undefined }),
      });
      setShowTeacher(false);
      setTeacher({ name: "", email: "", temporaryPassword: "" });
      notifyAction("Teacher account created by Admin", "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not create teacher", "error");
    }
  };

  const createAcademic = async () => {
    try {
      const endpoint =
        academic.type === "grade" ? "/students/grades" : academic.type === "class" ? "/students/classes" : "/students/subjects";
      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          name: academic.name,
          code: academic.code,
          ...(academic.type === "class" ? { gradeId: academic.gradeId, room: academic.room || undefined } : {}),
        }),
      });
      setAcademic({ type: academic.type, name: "", code: "", gradeId: "", room: "" });
      await load();
      notifyAction(`${academic.type} created`, "success");
    } catch (error: any) {
      notifyAction(error.message || "Could not save academic setup", "error");
    }
  };

  return (
    <DashboardLayout title="Student Management">
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-100">Admin Portal</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Student Management</h1>
              <p className="mt-1 text-sm text-blue-100">Profiles, placements, guardians, admissions history and access control.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
                <Upload className="mr-2 inline h-4 w-4" />
                Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={(e) => void importCsv(e.target.files?.[0])} />
              </label>
              <button onClick={exportCsv} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">
                <Download className="mr-2 inline h-4 w-4" />
                Export
              </button>
              <button onClick={() => setShowAcademic(true)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">
                <GraduationCap className="mr-2 inline h-4 w-4" />
                Academic Setup
              </button>
              <button onClick={() => setShowTeacher(true)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">
                <UserRound className="mr-2 inline h-4 w-4" />
                New Teacher
              </button>
              <button
                onClick={() => {
                  setEditing({ ...emptyStudent });
                  setShowEditor(true);
                }}
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-700"
              >
                <Plus className="mr-2 inline h-4 w-4" />
                New Student
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric icon={Users} label="Active students" value={items.length} />
          <Metric icon={GraduationCap} label="Grades" value={grades.length} />
          <Metric
            icon={Link2}
            label="Guardian links"
            value={items.reduce((sum: number, item: any) => sum + (item.guardians?.length || 0), 0)}
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-3 border-b p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
                placeholder="Search name, student number or ID..."
              />
            </div>
            <select className="rounded-lg border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>ACTIVE</option>
              <option>ARCHIVED</option>
            </select>
            <button onClick={() => void load()} className="rounded-lg border px-4 text-sm font-semibold">
              Search
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th>Number</th>
                  <th>Grade / class</th>
                  <th>Guardians</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setSelected(item);
                      void apiRequest(`/students/${item.id}`).then(setSelected);
                    }}
                    className="cursor-pointer border-t hover:bg-blue-50/40"
                  >
                    <td className="px-5 py-4">
                      <b>
                        {item.firstName} {item.lastName}
                      </b>
                      <p className="text-xs text-gray-500">{item.identityNumber || "No identity number"}</p>
                    </td>
                    <td>{item.studentNumber}</td>
                    <td>
                      {grades.find((grade: any) => grade.id === item.gradeId)?.name || "Unassigned"} ·{" "}
                      {classes.find((entry: any) => entry.id === item.classId)?.name || "No class"}
                    </td>
                    <td>{item.guardians?.length || 0}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          item.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <p className="p-10 text-center text-sm text-gray-500">No students match this view.</p>}
          </div>
        </div>
      </div>

      <Modal title={editing?.id ? "Edit Student" : "Create Student"} isOpen={showEditor} onClose={() => setShowEditor(false)} wide>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["firstName", "First name"],
            ["lastName", "Last name"],
            ["preferredName", "Preferred name"],
            ["dateOfBirth", "Date of birth"],
            ["identityNumber", "ID / birth certificate"],
            ["studentNumber", "Student number"],
            ["email", "Student email"],
            ["phone", "Phone"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type={key === "dateOfBirth" ? "date" : "text"}
                className={inputClass}
                value={editing?.[key] || ""}
                onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Grade">
            <select
              className={inputClass}
              value={editing?.gradeId || ""}
              onChange={(e) => setEditing({ ...editing, gradeId: e.target.value, classId: "" })}
            >
              <option value="">Unassigned</option>
              {grades.map((grade: any) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select
              className={inputClass}
              value={editing?.classId || ""}
              onChange={(e) => setEditing({ ...editing, classId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {filteredClasses.map((entry: any) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Medical notes">
            <textarea
              className={inputClass}
              value={editing?.medicalNotes || ""}
              onChange={(e) => setEditing({ ...editing, medicalNotes: e.target.value })}
            />
          </Field>
        </div>
        <button onClick={() => void save()} className="mt-5 w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white">
          Save student
        </button>
      </Modal>

      <Modal
        title={selected ? `${selected.firstName} ${selected.lastName}` : "Student"}
        isOpen={!!selected && !showGuardian && !showMove && !showEditor}
        onClose={() => setSelected(null)}
        wide
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEditing({ ...emptyStudent, ...selected, dateOfBirth: selected.dateOfBirth?.slice(0, 10) || "" });
                  setShowEditor(true);
                }}
                className="btn"
              >
                Edit
              </button>
              <button onClick={() => setShowGuardian(true)} className="btn">
                <Link2 className="mr-1 inline h-4 w-4" />
                Link guardian
              </button>
              <button
                onClick={() => {
                  setMove({ gradeId: selected.gradeId || "", classId: selected.classId || "", reason: "Class transfer" });
                  setShowMove(true);
                }}
                className="btn"
              >
                <ArrowRightLeft className="mr-1 inline h-4 w-4" />
                Transfer / promote
              </button>
              <button onClick={() => void archive()} className="btn text-red-600">
                <Archive className="mr-1 inline h-4 w-4" />
                Archive
              </button>
            </div>

            <section>
              <h3 className="font-bold">Guardians</h3>
              <div className="mt-2 space-y-2">
                {selected.guardians?.map((link: any) => (
                  <div key={link.id} className="rounded-xl border p-3">
                    <div className="flex justify-between">
                      <div>
                        <b className="text-sm">{link.guardian.name || link.guardian.email}</b>
                        <p className="text-xs text-gray-500">
                          {link.relationshipType} · {link.guardian.email}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600">{link.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {permissionKeys.filter((key) => link[key]).map(humanize).join(" · ")}
                    </p>
                  </div>
                ))}
                {!selected.guardians?.length && (
                  <p className="text-sm text-amber-700">No guardian is linked. Parent accounts cannot see this student.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="font-bold">Placement history</h3>
              {selected.classHistory?.map((entry: any) => (
                <p key={entry.id} className="mt-2 text-sm text-gray-600">
                  {new Date(entry.changedAt).toLocaleDateString()} · {entry.reason}
                </p>
              ))}
            </section>
          </div>
        )}
      </Modal>

      <Modal title="Link parent or guardian" isOpen={showGuardian} onClose={() => setShowGuardian(false)}>
        <div className="space-y-4">
          <Field label="Email">
            <input className={inputClass} value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} />
          </Field>
          <Field label="Name">
            <input className={inputClass} value={guardian.name} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} />
          </Field>
          <Field label="Relationship">
            <select
              className={inputClass}
              value={guardian.relationshipType}
              onChange={(e) => setGuardian({ ...guardian, relationshipType: e.target.value })}
            >
              {["Mother", "Father", "Guardian", "Grandparent", "Sponsor", "Emergency contact", "Pickup authorised person"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {permissionKeys.map((key) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={guardian[key]} onChange={(e) => setGuardian({ ...guardian, [key]: e.target.checked })} />
                {humanize(key)}
              </label>
            ))}
          </div>
          <button onClick={() => void linkGuardian()} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white">
            Verify and link guardian
          </button>
        </div>
      </Modal>

      <Modal title="Transfer or promote student" isOpen={showMove} onClose={() => setShowMove(false)}>
        <div className="space-y-4">
          <Field label="Grade">
            <select
              className={inputClass}
              value={move.gradeId}
              onChange={(e) => setMove({ ...move, gradeId: e.target.value, classId: "" })}
            >
              <option value="">Unassigned</option>
              {grades.map((grade: any) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select className={inputClass} value={move.classId} onChange={(e) => setMove({ ...move, classId: e.target.value })}>
              <option value="">Unassigned</option>
              {classes
                .filter((entry: any) => !move.gradeId || entry.gradeId === move.gradeId)
                .map((entry: any) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Reason">
            <select className={inputClass} value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })}>
              <option>Class transfer</option>
              <option>Grade promotion</option>
              <option>Placement correction</option>
            </select>
          </Field>
          <button onClick={() => void transfer()} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white">
            Apply placement
          </button>
        </div>
      </Modal>

      <Modal title="Create teacher account" isOpen={showTeacher} onClose={() => setShowTeacher(false)}>
        <div className="space-y-4">
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            Teachers cannot self-register. This creates an Admin-managed account; Microsoft or Google sync may also provision staff when enabled.
          </p>
          <Field label="Full name">
            <input className={inputClass} value={teacher.name} onChange={(e) => setTeacher({ ...teacher, name: e.target.value })} />
          </Field>
          <Field label="School email">
            <input type="email" className={inputClass} value={teacher.email} onChange={(e) => setTeacher({ ...teacher, email: e.target.value })} />
          </Field>
          <Field label="Temporary password (optional)">
            <input
              type="password"
              className={inputClass}
              value={teacher.temporaryPassword}
              onChange={(e) => setTeacher({ ...teacher, temporaryPassword: e.target.value })}
            />
          </Field>
          <button onClick={() => void createTeacher()} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white">
            Create teacher
          </button>
        </div>
      </Modal>

      <Modal title="Academic setup" isOpen={showAcademic} onClose={() => setShowAcademic(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {["grade", "class", "subject"].map((type) => (
              <button
                key={type}
                onClick={() => setAcademic({ type, name: "", code: "", gradeId: "", room: "" })}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${academic.type === type ? "bg-blue-600 text-white" : "border"}`}
              >
                {humanize(type)}
              </button>
            ))}
          </div>
          <Field label="Name">
            <input className={inputClass} value={academic.name} onChange={(e) => setAcademic({ ...academic, name: e.target.value })} />
          </Field>
          <Field label="Code">
            <input className={inputClass} value={academic.code} onChange={(e) => setAcademic({ ...academic, code: e.target.value })} />
          </Field>
          {academic.type === "class" && (
            <>
              <Field label="Grade">
                <select
                  className={inputClass}
                  value={academic.gradeId}
                  onChange={(e) => setAcademic({ ...academic, gradeId: e.target.value })}
                >
                  <option value="">Select grade</option>
                  {grades.map((grade: any) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Room">
                <input className={inputClass} value={academic.room} onChange={(e) => setAcademic({ ...academic, room: e.target.value })} />
              </Field>
            </>
          )}
          <button onClick={() => void createAcademic()} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white">
            Create {academic.type}
          </button>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            {grades.length} grades · {classes.length} classes · {subjects.length} subjects configured
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-600" />
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
