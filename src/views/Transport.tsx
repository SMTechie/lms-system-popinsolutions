import React, { useEffect, useRef, useState } from "react";
import { Bus, Camera, Check, Search, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Modal from "../components/Modal";
import PortalLoader from "../components/PortalLoader";
import { apiRequest } from "../lib/api";
import { notifyAction } from "../lib/notify";

export default function Transport() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({ applications: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState("");
  const [vehicle, setVehicle] = useState({
    name: "",
    registration: "",
    capacity: "",
    driverName: "",
    driverPhone: "",
  });
  const [route, setRoute] = useState({
    name: "",
    vehicleId: "",
    morningTime: "",
    afternoonTime: "",
    stops: "",
  });
  const [assignment, setAssignment] = useState({
    learnerId: "",
    routeId: "",
    stop: "",
  });
  const [learnerPickerQuery, setLearnerPickerQuery] = useState("");
  const [routePickerQuery, setRoutePickerQuery] = useState("");
  const [qrCodeValue, setQrCodeValue] = useState("");
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showBoardingRegister, setShowBoardingRegister] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [vehiclePage, setVehiclePage] = useState(1);
  const [routePage, setRoutePage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [movementSearch, setMovementSearch] = useState("");
  const [movementPage, setMovementPage] = useState(1);
  const [applicationPage, setApplicationPage] = useState(1);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      setData(await apiRequest("/admin/transport"));
    } catch (error: any) {
      notifyAction(
        error.message || "Could not load transport applications.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setShowBoardingRegister(location.pathname === "/transport/boarding");
  }, [location.pathname]);
  const stopCamera = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setCameraActive(false);
  };
  const startCamera = async () => {
    setCameraError("");
    try {
      setCameraActive(true);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const video = videoRef.current; if (!video) throw new Error("Camera preview is not ready.");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      scannerControlsRef.current = await reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (!result) return;
        setQrCodeValue(result.getText());
        stopCamera();
        notifyAction("QR code scanned.", "success");
      });
    } catch (error: any) { setCameraError(error.name === "NotAllowedError" ? "Camera access was denied. Allow camera access and try again." : "Could not start the camera. Paste the learner QR value instead."); stopCamera(); }
  };
  useEffect(() => () => stopCamera(), []);
  const decide = async (id: string, decision: "approve" | "reject") => {
    setProcessing(id);
    try {
      await apiRequest(`/admin/transport/${id}/${decision}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      notifyAction(
        `Transport application ${decision === "approve" ? "approved" : "rejected"}.`,
        "success",
      );
      await load();
    } catch (error: any) {
      notifyAction(error.message || "Could not review application.", "error");
    } finally {
      setProcessing("");
    }
  };
  const save = async (path: string, body: any, success: string) => {
    try {
      await apiRequest(path, { method: "POST", body: JSON.stringify(body) });
      notifyAction(success, "success");
      await load();
    } catch (error: any) {
      notifyAction(
        error.message || "Could not save transport details.",
        "error",
      );
    }
  };
  const rows = (data.applications || []).filter((item: any) =>
    `${item.learner?.firstName || ""} ${item.learner?.lastName || ""} ${item.learner?.studentNumber || ""} ${item.routePreference || ""} ${item.status || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const tableRows = (items: any[], query: string, fields: string[]) => items.filter((item) => fields.some((field) => String(field.split('.').reduce((value: any, key) => value?.[key], item) || '').toLowerCase().includes(query.toLowerCase())));
  const pageRows = (items: any[], page: number) => items.slice((page - 1) * 10, page * 10);
  const vehicleRows = tableRows(data.vehicles || [], vehicleSearch, ['name', 'registration', 'driverName', 'driverPhone']);
  const routeRows = tableRows(data.routes || [], routeSearch, ['name', 'morningTime', 'afternoonTime']);
  const assignmentRows = tableRows(data.assignments || [], assignmentSearch, ['learner.firstName', 'learner.lastName', 'learner.studentNumber', 'route.name', 'stop', 'status']);
  const movementRows = tableRows(data.attendance || [], movementSearch, ['direction', 'scannedBy', 'scannedAt']);
  return (
    <DashboardLayout title="School Transport">
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-sky-950 via-blue-800 to-cyan-600 p-6 text-white shadow-xl">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-white/15 p-3">
              <Bus className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
                Operations
              </p>
              <h2 className="mt-1 text-3xl font-bold">School transport</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                Review parent enrolment requests and keep transport allocations
                ready for the next route run.
              </p>
            </div>
          </div>
        </section>
        {loading ? (
          <PortalLoader label="Loading transport applications..." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric
                label="Awaiting review"
                value={data.summary?.pending || 0}
              />
              <Metric label="Approved" value={data.summary?.approved || 0} />
              <Metric
                label="Not approved"
                value={data.summary?.rejected || 0}
              />
            </div>
            <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">Vehicles</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Registered vehicles and drivers.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowVehicleForm((value) => !value)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    {showVehicleForm ? "Close form" : "+ Add vehicle"}
                  </button>
                </div>
                <input value={vehicleSearch} onChange={(event) => { setVehicleSearch(event.target.value); setVehiclePage(1); }} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Search vehicle, registration, or driver..." />
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-400">
                      <tr>
                        <th className="pb-2">Vehicle</th>
                        <th className="pb-2">Driver</th>
                        <th className="pb-2 text-right">Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows(vehicleRows, vehiclePage).map((item: any) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-3 font-semibold text-slate-800">
                            {item.name}
                            <span className="block text-xs font-normal text-slate-500">
                              {item.registration}
                            </span>
                          </td>
                          <td className="py-3 text-slate-700">
                            {item.driverName || "Not assigned"}
                            <span className="block text-xs text-slate-500">
                              {item.driverPhone || ""}
                            </span>
                          </td>
                          <td className="py-3 text-right font-semibold">
                            {item.capacity}
                          </td>
                        </tr>
                      ))}
                      {!(data.vehicles || []).length && (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center text-sm text-slate-400"
                          >
                            No vehicles registered.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <TableSummary count={vehicleRows.length} page={vehiclePage} onPageChange={setVehiclePage} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">Routes</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Active routes and their pickup stops.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRouteForm((value) => !value)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    {showRouteForm ? "Close form" : "+ Add route"}
                  </button>
                </div>
                <input value={routeSearch} onChange={(event) => { setRouteSearch(event.target.value); setRoutePage(1); }} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Search route, stop, or schedule..." />
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-400">
                      <tr>
                        <th className="pb-2">Route</th>
                        <th className="pb-2">Stops</th>
                        <th className="pb-2">Schedule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows(routeRows, routePage).map((item: any) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-3 font-semibold text-slate-800">
                            {item.name}
                          </td>
                          <td className="py-3 text-slate-600">
                            {(item.stops || []).join(", ") || "No stops set"}
                          </td>
                          <td className="py-3 text-xs text-slate-600">
                            {item.morningTime || "—"} /{" "}
                            {item.afternoonTime || "—"}
                          </td>
                        </tr>
                      ))}
                      {!(data.routes || []).length && (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center text-sm text-slate-400"
                          >
                            No routes created.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <TableSummary count={routeRows.length} page={routePage} onPageChange={setRoutePage} />
              </div>
            </section>
            {false && (
              <section className="grid gap-5 xl:grid-cols-2">
                {showVehicleForm && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(
                        "/admin/transport/vehicles",
                        vehicle,
                        "Vehicle added.",
                      );
                      setShowVehicleForm(false);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-bold text-slate-950">
                      Vehicle and driver
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Register a vehicle before creating its route.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ["name", "Vehicle name"],
                        ["registration", "Registration"],
                        ["capacity", "Seats"],
                        ["driverName", "Driver name"],
                        ["driverPhone", "Driver phone"],
                      ].map(([key, label]) => (
                        <input
                          key={key}
                          required={
                            key === "registration" || key === "capacity"
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          placeholder={label}
                          value={(vehicle as any)[key]}
                          onChange={(event) =>
                            setVehicle((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      ))}
                    </div>
                    <button className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      Save vehicle
                    </button>
                  </form>
                )}
                {showRouteForm && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(
                        "/admin/transport/routes",
                        route,
                        "Route created.",
                      );
                      setShowRouteForm(false);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-bold text-slate-950">
                      Route and stops
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Set stops as a comma-separated list. Transport billing is
                      managed in Payments.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input
                        required
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Route name"
                        value={route.name}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                      <select
                        required
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={route.vehicleId}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            vehicleId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose vehicle</option>
                        {(data.vehicles || []).map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.registration}
                          </option>
                        ))}
                      </select>
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Morning time"
                        value={route.morningTime}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            morningTime: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Afternoon time"
                        value={route.afternoonTime}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            afternoonTime: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                        placeholder="Stops, comma separated"
                        value={route.stops}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            stops: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <button className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      Save route
                    </button>
                  </form>
                )}
              </section>
            )}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-950">
                    Route assignments
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Learners currently allocated to a transport route.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAssignment({ learnerId: "", routeId: "", stop: "" });
                    setLearnerPickerQuery("");
                    setRoutePickerQuery("");
                    setShowAssignmentForm(true);
                  }}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  + Assign learner
                </button>
              </div>
              <input value={assignmentSearch} onChange={(event) => { setAssignmentSearch(event.target.value); setAssignmentPage(1); }} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Search learner, route, or stop..." />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-400">
                    <tr>
                      <th className="pb-2">Learner</th>
                      <th className="pb-2">Route</th>
                      <th className="pb-2">Stop</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows(assignmentRows, assignmentPage).map((item: any) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 font-semibold text-slate-800">
                          {item.learner?.firstName} {item.learner?.lastName}
                          <span className="block text-xs font-normal text-slate-500">
                            {item.learner?.studentNumber}
                          </span>
                        </td>
                        <td className="py-3 text-slate-700">
                          {item.route?.name || "Route unavailable"}
                        </td>
                        <td className="py-3 text-slate-700">{item.stop}</td>
                        <td className="py-3 text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!(data.assignments || []).length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-sm text-slate-400"
                        >
                          No learner route assignments yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TableSummary count={assignmentRows.length} page={assignmentPage} onPageChange={setAssignmentPage} />
            </section>
            {false && (
              <section>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(
                      "/admin/transport/assignments",
                      assignment,
                      "Learner assigned to transport.",
                    );
                  }}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-bold text-slate-950">Route assignment</h3>
                  <div className="mt-4 grid gap-3">
                    <select
                      required
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={assignment.learnerId}
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          learnerId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose approved learner</option>
                      {(data.applications || [])
                        .filter((item: any) => item.status === "APPROVED")
                        .map((item: any) => (
                          <option key={item.id} value={item.learnerId}>
                            {item.learner?.firstName} {item.learner?.lastName} ·{" "}
                            {item.learner?.studentNumber}
                          </option>
                        ))}
                    </select>
                    <select
                      required
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={assignment.routeId}
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          routeId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose route</option>
                      {(data.routes || []).map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Assigned stop"
                      value={assignment.stop}
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          stop: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <button className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                    Assign learner
                  </button>
                </form>
              </section>
            )}
            {false && <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-950">
                  Active route allocations
                </h3>
                <div className="mt-3 space-y-2">
                  {(data.assignments || []).length ? (
                    data.assignments.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.learner?.firstName} {item.learner?.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.route?.name || "Route"} · {item.stop}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700">
                          ACTIVE
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-5 text-sm text-slate-400">
                      No learners have been assigned yet.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-950">
                  Latest movement register
                </h3>
                <div className="mt-3 space-y-2">
                  {(data.attendance || []).length ? (
                    data.attendance.slice(0, 6).map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.direction === "DROP_OFF"
                              ? "Drop-off"
                              : "Boarding"}{" "}
                            recorded
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(item.scannedAt).toLocaleString("en-ZA")}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500">
                          {item.scannedBy}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-5 text-sm text-slate-400">
                      No QR movements have been recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </section>}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-950">Latest movement register</h3><input value={movementSearch} onChange={(event) => { setMovementSearch(event.target.value); setMovementPage(1); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64" placeholder="Search event or staff..." /></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-2">Event</th><th className="pb-2">Recorded at</th><th className="pb-2">Recorded by</th></tr></thead><tbody>{pageRows(movementRows, movementPage).map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 font-semibold text-slate-800">{item.direction === 'DROP_OFF' ? 'Drop-off' : 'Boarding'}</td><td className="py-3 text-slate-600">{new Date(item.scannedAt).toLocaleString('en-ZA')}</td><td className="py-3 text-slate-600">{item.scannedBy}</td></tr>)}{!movementRows.length && <tr><td colSpan={3} className="py-8 text-center text-sm text-slate-400">No QR movements match this search.</td></tr>}</tbody></table></div><TableSummary count={movementRows.length} page={movementPage} onPageChange={setMovementPage} /></section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-950">
                    Enrolment applications
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Approve or reject each learner’s transport request.
                  </p>
                </div>
                <label className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setApplicationPage(1); }}
                    className="w-72 rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    placeholder="Search learner or route..."
                  />
                </label>
              </div>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Learner</th>
                      <th className="px-4 py-3">Pickup details</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows(rows, applicationPage).map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {item.learner
                              ? `${item.learner.firstName} ${item.learner.lastName}`
                              : "Learner unavailable"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.learner?.studentNumber || ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{item.pickupAddress}</p>
                          <p className="text-xs text-slate-500">
                            {item.pickupContact}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.routePreference}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {new Date(item.submittedAt).toLocaleDateString(
                            "en-ZA",
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : item.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                disabled={processing === item.id}
                                onClick={() => void decide(item.id, "approve")}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                <Check className="mr-1 inline h-3 w-3" />
                                Approve
                              </button>
                              <button
                                disabled={processing === item.id}
                                onClick={() => void decide(item.id, "reject")}
                                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                              >
                                <X className="mr-1 inline h-3 w-3" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Reviewed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-sm text-slate-400"
                        >
                          No transport applications match this search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TableSummary count={rows.length} total={(data.applications || []).length} page={applicationPage} onPageChange={setApplicationPage} />
            </section>
          </>
        )}
        <Modal
          title="QR boarding register"
          isOpen={showBoardingRegister}
          onClose={() => {
            stopCamera();
            setShowBoardingRegister(false);
            navigate("/transport");
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Use the camera to scan the learner QR code, or paste the value if needed.
            </p>
            {!cameraActive ? <button onClick={() => void startCamera()} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><Camera className="mr-2 inline h-4 w-4" />Open camera scanner</button> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /><button onClick={stopCamera} className="w-full bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Stop camera</button></div>}
            {cameraError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{cameraError}</p>}
            <input
              autoFocus
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="Learner QR value"
              value={qrCodeValue}
              onChange={(event) => setQrCodeValue(event.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() =>
                  void save(
                    "/admin/transport/scan",
                    { qrCodeValue, direction: "BOARDING" },
                    "Boarding recorded.",
                  )
                }
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Record boarding
              </button>
              <button
                onClick={() =>
                  void save(
                    "/admin/transport/scan",
                    { qrCodeValue, direction: "DROP_OFF" },
                    "Drop-off recorded.",
                  )
                }
                className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700"
              >
                Record drop-off
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          title="Add vehicle"
          isOpen={showVehicleForm}
          onClose={() => setShowVehicleForm(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save("/admin/transport/vehicles", vehicle, "Vehicle added.");
              setShowVehicleForm(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["name", "Vehicle name"],
                ["registration", "Registration"],
                ["capacity", "Seats"],
                ["driverName", "Driver name"],
                ["driverPhone", "Driver phone"],
              ].map(([key, label]) => (
                <input
                  key={key}
                  required={key === "registration" || key === "capacity"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder={label}
                  value={(vehicle as any)[key]}
                  onChange={(event) =>
                    setVehicle((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              ))}
            </div>
            <button className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white">
              Save vehicle
            </button>
          </form>
        </Modal>
        <Modal
          title="Assign learner to route"
          isOpen={showAssignmentForm}
          onClose={() => setShowAssignmentForm(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!assignment.learnerId || !assignment.routeId) {
                notifyAction("Choose a learner and route from the search results.", "warning");
                return;
              }
              void save(
                "/admin/transport/assignments",
                assignment,
                "Learner assigned to transport.",
              );
              setShowAssignmentForm(false);
            }}
            className="space-y-4"
          >
            <label className="block text-xs font-semibold text-slate-600">
              Approved learner
              <input
                required
                list="transport-approved-learners"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={learnerPickerQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  const match = (data.applications || []).filter((item: any) => item.status === "APPROVED").find((item: any) => `${item.learner?.firstName || ""} ${item.learner?.lastName || ""} · ${item.learner?.studentNumber || ""}` === value);
                  setLearnerPickerQuery(value);
                  setAssignment((current) => ({ ...current, learnerId: match?.learnerId || "" }));
                }}
                placeholder="Search approved learner..."
              />
              <datalist id="transport-approved-learners">
                {(data.applications || []).filter((item: any) => item.status === "APPROVED").map((item: any) => {
                  const label = `${item.learner?.firstName || ""} ${item.learner?.lastName || ""} · ${item.learner?.studentNumber || ""}`;
                  return <option key={item.id} value={label} />;
                })}
              </datalist>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Route
              <input
                required
                list="transport-routes"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={routePickerQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  const match = (data.routes || []).find((item: any) => item.name === value);
                  setRoutePickerQuery(value);
                  setAssignment((current) => ({ ...current, routeId: match?.id || "" }));
                }}
                placeholder="Search route..."
              />
              <datalist id="transport-routes">
                {(data.routes || []).map((item: any) => <option key={item.id} value={item.name} />)}
              </datalist>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Assigned stop"
              value={assignment.stop}
              onChange={(event) =>
                setAssignment((current) => ({
                  ...current,
                  stop: event.target.value,
                }))
              }
            />
            <button className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white">
              Assign learner
            </button>
          </form>
        </Modal>
        <Modal
          title="Add route"
          isOpen={showRouteForm}
          onClose={() => setShowRouteForm(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save("/admin/transport/routes", route, "Route created.");
              setShowRouteForm(false);
            }}
            className="space-y-4"
          >
            <input
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Route name"
              value={route.name}
              onChange={(event) =>
                setRoute((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <select
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={route.vehicleId}
              onChange={(event) =>
                setRoute((current) => ({
                  ...current,
                  vehicleId: event.target.value,
                }))
              }
            >
              <option value="">Choose vehicle</option>
              {(data.vehicles || []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.registration}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Morning time"
                value={route.morningTime}
                onChange={(event) =>
                  setRoute((current) => ({
                    ...current,
                    morningTime: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Afternoon time"
                value={route.afternoonTime}
                onChange={(event) =>
                  setRoute((current) => ({
                    ...current,
                    afternoonTime: event.target.value,
                  }))
                }
              />
            </div>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Stops, comma separated"
              value={route.stops}
              onChange={(event) =>
                setRoute((current) => ({
                  ...current,
                  stops: event.target.value,
                }))
              }
            />
            <button className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white">
              Save route
            </button>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function TableSummary({ count, total = count, page = 1, onPageChange }: { count: number; total?: number; page?: number; onPageChange?: (page: number) => void }) {
  const size = 10;
  const pages = Math.max(1, Math.ceil(count / size));
  const start = count ? (page - 1) * size + 1 : 0;
  const end = count ? Math.min(page * size, count) : 0;
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500"><span>Showing {start}–{end} of {total} records</span>{onPageChange && <div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => onPageChange(Math.min(pages, page + 1))} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40">Next</button></div>}</div>;
}
