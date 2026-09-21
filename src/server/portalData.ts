import { randomUUID } from "crypto";
import { getSetting, putSetting } from "./settings";

const now = () => new Date().toISOString();

export type PortalData = ReturnType<typeof defaultPortalData>;

export function defaultPortalData() {
  const grades = [
    { id: "grade-8", name: "Grade 8", code: "G8" },
    { id: "grade-9", name: "Grade 9", code: "G9" },
  ];
  const subjects = [
    { id: "subject-math", name: "Mathematics", code: "MATH" },
    { id: "subject-science", name: "Natural Sciences", code: "SCI" },
    { id: "subject-english", name: "English", code: "ENG" },
  ];
  const learners = [
    {
      id: "learner-1",
      firstName: "Ari",
      lastName: "Khumalo",
      preferredName: "Ari",
      dateOfBirth: "2012-03-14",
      identityNumber: "1203140000000",
      email: "ari.khumalo@school.co.za",
      phone: "",
      studentNumber: "POP-7001",
      gradeId: "grade-8",
      classId: "class-8a",
      status: "ACTIVE",
      medicalNotes: "Mild peanut allergy.",
    },
    {
      id: "learner-2",
      firstName: "Mila",
      lastName: "Khumalo",
      preferredName: "Mila",
      dateOfBirth: "2011-09-02",
      identityNumber: "1109020000000",
      email: "mila.khumalo@school.co.za",
      phone: "",
      studentNumber: "POP-6904",
      gradeId: "grade-9",
      classId: "class-9b",
      status: "ACTIVE",
      medicalNotes: "",
    },
  ];
  const guardian = {
    id: "guardian-1",
    email: "parent@popin.school",
    name: "Sarah Khumalo",
  };
  const guardianLinks = learners.map((learner, index) => ({
    id: `guardian-link-${index + 1}`,
    learnerId: learner.id,
    guardian,
    relationshipType: index === 0 ? "Mother" : "Guardian",
    status: "VERIFIED",
    isPrimary: index === 0,
    viewFees: true,
    payFees: true,
    viewReports: true,
    viewHomework: true,
    receiveAnnouncements: true,
    messageTeachers: true,
    authorisePickup: true,
    submitApplications: true,
    bookAppointments: true,
    viewHostel: true,
    applyHostel: true,
    viewHostelBilling: true,
    submitHostelConcerns: true,
    viewHostelMovement: true,
  }));
  const classes = [
    {
      id: "class-8a",
      name: "8A",
      gradeId: "grade-8",
      room: "B12",
      grade: grades[0],
      learners: [learners[0]],
      assignments: [{ subject: "Mathematics" }, { subject: "Natural Sciences" }],
      timetable: [
        { id: "tt-1", startsAt: "08:00", endsAt: "08:45", subject: "Mathematics", room: "B12", class: { name: "8A", room: "B12" } },
        { id: "tt-2", startsAt: "09:00", endsAt: "09:45", subject: "Natural Sciences", room: "Lab 2", class: { name: "8A", room: "B12" } },
      ],
      workItems: [
        { id: "work-1", type: "HOMEWORK", title: "Algebra practice", status: "PUBLISHED", dueAt: "2026-06-24T14:00:00.000Z", instructions: "Complete exercises 1 to 12.", visibleToParents: true },
        { id: "work-2", type: "LESSON_PLAN", title: "Fractions revision", status: "DRAFT", instructions: "Review common denominators.", visibleToParents: false },
        { id: "work-3", type: "ASSESSMENT", title: "Science quiz", status: "PUBLISHED", dueAt: "2026-06-28T10:00:00.000Z", instructions: "Short quiz on lab safety.", visibleToParents: true },
      ],
    },
    {
      id: "class-9b",
      name: "9B",
      gradeId: "grade-9",
      room: "C08",
      grade: grades[1],
      learners: [learners[1]],
      assignments: [{ subject: "English" }, { subject: "Mathematics" }],
      timetable: [{ id: "tt-3", startsAt: "10:00", endsAt: "10:45", subject: "English", room: "C08", class: { name: "9B", room: "C08" } }],
      workItems: [{ id: "work-4", type: "HOMEWORK", title: "Comprehension worksheet", status: "PUBLISHED", dueAt: "2026-06-25T14:00:00.000Z", instructions: "Read and answer the worksheet.", visibleToParents: true }],
    },
  ];

  const applicationForm = {
    id: "form-admissions",
    name: "Admissions Application",
    slug: "admissions",
    admissionsOpenState: "open",
    opensAt: "",
    closesAt: "",
    closedMessage: "Admissions are currently closed.",
    openingMessage: "Applications are open for the 2026 academic year.",
    publishedVersionId: "form-version-1",
    versions: [
      {
        id: "form-version-1",
        version: 1,
        createdAt: now(),
        schemaJson: {
          title: "Admissions Application",
          description: "Complete the form to apply for primary school admission and optional hostel placement.",
          steps: [
            {
              id: "step-learner",
              title: "Learner details",
              fields: [
                { id: "field-step1-section", type: "section", key: "learner_section", label: "Learner profile" },
                { id: "field-student-first-name", type: "text", key: "student_first_name", label: "Learner First Name", required: true, placeholder: "Enter first name" },
                { id: "field-student-middle-name", type: "text", key: "student_middle_name", label: "Middle Name", placeholder: "If applicable" },
                { id: "field-student-last-name", type: "text", key: "student_last_name", label: "Learner Surname", required: true, placeholder: "Enter surname" },
                { id: "field-student-name", type: "text", key: "student_name", label: "Full Name As Per Birth Certificate", required: true, placeholder: "Enter full name" },
                { id: "field-student-dob", type: "date", key: "student_birthdate", label: "Date of Birth", required: true },
                { id: "field-student-gender", type: "select", key: "student_gender", label: "Gender", required: true, options: ["Female", "Male", "Prefer not to say"] },
                { id: "field-student-id", type: "text", key: "student_identity_number", label: "Birth Certificate / ID / Passport Number", required: true, placeholder: "Enter official document number" },
                { id: "field-student-nationality", type: "text", key: "student_nationality", label: "Nationality", required: true, placeholder: "Enter nationality" },
                { id: "field-student-language", type: "text", key: "student_home_language", label: "Home Language", required: true, placeholder: "Enter home language" },
                { id: "field-student-grade-current", type: "select", key: "student_current_grade", label: "Current Grade", required: true, options: ["Grade R", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"] },
                { id: "field-grade", type: "select", key: "student_grade", label: "Grade Applying For", required: true, options: ["Grade R", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"] },
                { id: "field-student-year", type: "number", key: "academic_year", label: "Academic Year Applying For", required: true, placeholder: "2027" },
                { id: "field-student-school", type: "text", key: "current_school_name", label: "Current / Previous School", placeholder: "Enter school name" },
                { id: "field-student-reason", type: "textarea", key: "admission_reason", label: "Why are you applying to this school?", placeholder: "Share the main reason for the application" },
              ],
            },
            {
              id: "step-family",
              title: "Parent and contact details",
              fields: [
                { id: "field-family-section", type: "section", key: "guardian_section", label: "Primary parent / guardian" },
                { id: "field-guardian-first-name", type: "text", key: "guardian_first_name", label: "Guardian First Name", required: true, placeholder: "Enter first name" },
                { id: "field-guardian-last-name", type: "text", key: "guardian_last_name", label: "Guardian Surname", required: true, placeholder: "Enter surname" },
                { id: "field-guardian-name", type: "text", key: "guardian_name", label: "Guardian Full Name", required: true, placeholder: "Enter full name" },
                { id: "field-guardian-relation", type: "select", key: "guardian_relationship", label: "Relationship To Learner", required: true, options: ["Mother", "Father", "Grandparent", "Aunt", "Uncle", "Legal Guardian", "Other"] },
                { id: "field-guardian-id", type: "text", key: "guardian_identity_number", label: "Guardian ID / Passport Number", required: true, placeholder: "Enter official document number" },
                { id: "field-guardian-email", type: "email", key: "guardian_email", label: "Guardian Email", required: true, placeholder: "name@example.com" },
                { id: "field-guardian-phone", type: "phone", key: "guardian_phone", label: "Guardian Mobile Number", required: true, placeholder: "Enter mobile number" },
                { id: "field-guardian-alt-phone", type: "phone", key: "guardian_alt_phone", label: "Alternative Contact Number", placeholder: "Enter alternative number" },
                { id: "field-guardian-occupation", type: "text", key: "guardian_occupation", label: "Occupation", placeholder: "Enter occupation" },
                { id: "field-guardian-employer", type: "text", key: "guardian_employer", label: "Employer", placeholder: "Enter employer name" },
                { id: "field-address-1", type: "text", key: "address_line1", label: "Street Address", required: true, placeholder: "Enter street address" },
                { id: "field-address-2", type: "text", key: "address_line2", label: "Suburb / Area", placeholder: "Enter suburb or area" },
                { id: "field-address-city", type: "text", key: "address_city", label: "City / Town", required: true, placeholder: "Enter city or town" },
                { id: "field-address-postal", type: "text", key: "address_postal_code", label: "Postal Code", required: true, placeholder: "Enter postal code" },
                { id: "field-second-guardian-divider", type: "divider", key: "guardian_two_divider", label: "Divider" },
                { id: "field-second-guardian-section", type: "section", key: "guardian_two_section", label: "Secondary parent / guardian" },
                { id: "field-second-guardian-name", type: "text", key: "guardian_two_name", label: "Second Guardian Full Name", placeholder: "Enter full name" },
                { id: "field-second-guardian-relation", type: "text", key: "guardian_two_relationship", label: "Relationship To Learner", placeholder: "Enter relationship" },
                { id: "field-second-guardian-email", type: "email", key: "guardian_two_email", label: "Second Guardian Email", placeholder: "name@example.com" },
                { id: "field-second-guardian-phone", type: "phone", key: "guardian_two_phone", label: "Second Guardian Mobile Number", placeholder: "Enter mobile number" },
                { id: "field-emergency-divider", type: "divider", key: "emergency_divider", label: "Divider" },
                { id: "field-emergency-section", type: "section", key: "emergency_section", label: "Emergency contact" },
                { id: "field-emergency-name", type: "text", key: "emergency_name", label: "Emergency Contact Name", required: true, placeholder: "Enter full name" },
                { id: "field-emergency-relation", type: "text", key: "emergency_relationship", label: "Relationship To Learner", required: true, placeholder: "Enter relationship" },
                { id: "field-emergency-phone", type: "phone", key: "emergency_phone", label: "Emergency Contact Number", required: true, placeholder: "Enter contact number" },
              ],
            },
            {
              id: "step-medical",
              title: "Medical and support needs",
              fields: [
                { id: "field-medical-section", type: "section", key: "medical_section", label: "Health information" },
                { id: "field-medical-aid-member", type: "text", key: "medical_aid_name", label: "Medical Aid / Insurance Provider", placeholder: "Enter provider name" },
                { id: "field-medical-aid-number", type: "text", key: "medical_aid_number", label: "Medical Aid Membership Number", placeholder: "Enter membership number" },
                { id: "field-doctor-name", type: "text", key: "doctor_name", label: "Family Doctor / Clinic", placeholder: "Enter doctor or clinic name" },
                { id: "field-doctor-phone", type: "phone", key: "doctor_phone", label: "Doctor / Clinic Contact Number", placeholder: "Enter contact number" },
                { id: "field-allergies", type: "textarea", key: "student_allergies", label: "Allergies", placeholder: "List allergies or write None" },
                { id: "field-medication", type: "textarea", key: "student_medication", label: "Medication Currently Taken", placeholder: "List medication or write None" },
                { id: "field-conditions", type: "textarea", key: "student_medical_conditions", label: "Medical Conditions / Disabilities", placeholder: "List any chronic conditions, disabilities, or write None" },
                { id: "field-immunisation", type: "radio", key: "immunisations_up_to_date", label: "Are immunisations up to date?", required: true, options: ["Yes", "No", "Not sure"] },
                { id: "field-support-needs", type: "checkbox_group", key: "support_needs", label: "Additional learner support needs", options: ["Speech or language support", "Occupational therapy", "Learning support", "Counselling support", "Behaviour support", "None"] },
                { id: "field-support-notes", type: "textarea", key: "support_needs_notes", label: "Support Notes", placeholder: "Share any learning, behavioural, or wellbeing notes the school should know" },
              ],
            },
            {
              id: "step-school-hostel",
              title: "School services and hostel",
              fields: [
                { id: "field-services-section", type: "section", key: "services_section", label: "Daily school arrangements" },
                { id: "field-transport", type: "select", key: "transport_mode", label: "Transport Arrangement", required: true, options: ["Parent drop-off and collection", "Private transport", "School transport", "Walking", "Other"] },
                { id: "field-collectors", type: "textarea", key: "authorised_collectors", label: "Authorised Persons Allowed To Collect The Learner", placeholder: "List names and contact numbers" },
                { id: "field-aftercare", type: "radio", key: "requires_aftercare", label: "Will the learner need aftercare?", required: true, options: ["Yes", "No"] },
                { id: "field-activities", type: "checkbox_group", key: "co_curricular_interests", label: "Co-curricular interests", options: ["Soccer", "Netball", "Athletics", "Choir", "Chess", "Art", "Dance", "Coding", "None yet"] },
                { id: "field-hostel-divider", type: "divider", key: "hostel_divider", label: "Divider" },
                { id: "field-hostel-section", type: "section", key: "hostel_section", label: "Hostel application" },
                { id: "field-hostel-needed", type: "radio", key: "hostel_required", label: "Would you like to apply for hostel accommodation?", required: true, options: ["Yes", "No"] },
                { id: "field-hostel-term", type: "select", key: "hostel_start_term", label: "Preferred Hostel Start Term", options: ["Term 1", "Term 2", "Term 3", "Term 4"] },
                { id: "field-hostel-boarder-type", type: "select", key: "hostel_boarding_type", label: "Boarding Type", options: ["Full boarding", "Weekly boarding", "Flexible boarding"] },
                { id: "field-hostel-weekend", type: "textarea", key: "hostel_weekend_arrangements", label: "Weekend / Holiday Arrangements", placeholder: "Explain who will collect the learner and weekend plans" },
                { id: "field-hostel-dietary", type: "textarea", key: "hostel_dietary_requirements", label: "Hostel Dietary Requirements", placeholder: "List dietary, cultural, or religious meal needs" },
                { id: "field-hostel-medical", type: "textarea", key: "hostel_medical_notes", label: "Hostel Medical / Supervision Notes", placeholder: "Share any care or supervision instructions for hostel staff" },
                { id: "field-hostel-consent", type: "checkbox", key: "hostel_rules_acceptance", label: "Hostel Rules Acceptance", required: true, placeholder: "I understand that hostel placement is subject to availability and acceptance of hostel rules." },
              ],
            },
            {
              id: "step-documents",
              title: "Documents and declarations",
              fields: [
                { id: "field-docs-section", type: "section", key: "documents_section", label: "Required supporting documents" },
                { id: "field-docs-help", type: "paragraph", key: "documents_help", label: "Please upload the key documents needed to review the application. PDF or image files are accepted." },
                { id: "field-doc-birth", type: "file", key: "document_birth_certificate", label: "Birth Certificate / ID Copy", required: true, fileTypes: ".pdf,.png,.jpg,.jpeg", maxSizeMb: 8 },
                { id: "field-doc-guardian-id", type: "file", key: "document_guardian_id", label: "Parent / Guardian ID Copy", required: true, fileTypes: ".pdf,.png,.jpg,.jpeg", maxSizeMb: 8 },
                { id: "field-doc-proof-address", type: "file", key: "document_proof_of_address", label: "Proof of Residential Address", required: true, fileTypes: ".pdf,.png,.jpg,.jpeg", maxSizeMb: 8 },
                { id: "field-doc-report", type: "file", key: "document_latest_report", label: "Latest School Report", fileTypes: ".pdf,.png,.jpg,.jpeg", maxSizeMb: 8 },
                { id: "field-doc-immunisation", type: "file", key: "document_immunisation_card", label: "Clinic Card / Immunisation Record", fileTypes: ".pdf,.png,.jpg,.jpeg", maxSizeMb: 8 },
                { id: "field-doc-hostel", type: "file", key: "document_hostel_supporting", label: "Hostel Supporting Documents (if applying)", fileTypes: ".pdf,.png,.jpg,.jpeg", maxSizeMb: 8 },
                { id: "field-declare-divider", type: "divider", key: "declaration_divider", label: "Divider" },
                { id: "field-declare-section", type: "section", key: "declaration_section", label: "Declarations" },
                { id: "field-consent-accuracy", type: "checkbox", key: "declaration_information_correct", label: "Information Declaration", required: true, placeholder: "I confirm that the information provided in this application is true and complete." },
                { id: "field-consent-school", type: "checkbox", key: "declaration_school_policies", label: "School Policies", required: true, placeholder: "I understand that admission is subject to the school's policies, assessment, and availability." },
                { id: "field-consent-processing", type: "checkbox", key: "declaration_data_processing", label: "Data Processing Consent", required: true, placeholder: "I consent to the school processing this information for admissions, communication, and learner support." },
              ],
            },
          ],
        },
      },
    ],
    submissions: [
      {
        id: "submission-1",
        submissionReference: "APP-0001",
        applicantName: "Neo Dlamini",
        guardianName: "Thandi Dlamini",
        guardianEmail: "thandi@example.com",
        status: "SUBMITTED",
        submittedAt: "2026-06-21T09:00:00.000Z",
        submissionChannel: "website",
      },
      {
        id: "submission-2",
        submissionReference: "APP-0002",
        learnerId: "learner-2",
        applicantName: "Mila Khumalo",
        guardianName: "Sarah Khumalo",
        guardianEmail: "parent@popin.school",
        status: "IN_REVIEW",
        submittedAt: "2026-07-12T11:30:00.000Z",
        submissionChannel: "parent-portal",
      },
    ],
  };

  const hostel = {
    qrPasses: [
      {
        id: "qr-pass-1",
        learnerId: "learner-1",
        code: "HST-POP-7001-V1",
        version: 1,
        active: true,
        issuedAt: "2026-01-15T06:00:00.000Z",
        rotatedAt: null,
        rotatedBy: null,
      },
      {
        id: "qr-pass-2",
        learnerId: "learner-2",
        code: "HST-POP-6904-V1",
        version: 1,
        active: true,
        issuedAt: "2026-01-15T06:05:00.000Z",
        rotatedAt: null,
        rotatedBy: null,
      },
    ],
    buildings: [
      {
        id: "hostel-building-1",
        name: "North House",
        code: "NH",
        genderPolicy: "MIXED",
        address: "Main campus",
        blocks: [
          {
            id: "hostel-block-1",
            name: "A Block",
            code: "A",
            rooms: [
              {
                id: "hostel-room-1",
                roomNumber: "A101",
                capacity: 2,
                monthlyFee: 2500,
                beds: [
                  { id: "hostel-bed-1", label: "Bed 1", status: "OCCUPIED" },
                  { id: "hostel-bed-2", label: "Bed 2", status: "AVAILABLE" },
                ],
              },
            ],
          },
        ],
      },
    ],
    applications: [{ id: "hostel-app-1", learnerId: "learner-2", academicYear: 2026, preferredBuildingId: "hostel-building-1", status: "WAITLISTED" }],
    allocations: [
      {
        id: "allocation-1",
        learnerId: "learner-1",
        bedId: "hostel-bed-1",
        status: "CHECKED_IN",
        startDate: "2026-01-15",
        checkedInAt: "2026-01-15T17:30:00.000Z",
      },
    ],
    rollCalls: [{ id: "roll-1", rollDate: "2026-06-22", session: "MORNING", status: "SUBMITTED", entries: [{ learnerId: "learner-1", status: "PRESENT" }] }],
    scanEvents: [
      {
        id: "scan-1",
        learnerId: "learner-1",
        eventType: "ROLL_CALL_PRESENT",
        context: "MORNING_ROLL_CALL",
        scannedAt: "2026-07-30T06:15:00.000Z",
        scannedBy: "Hostel Supervisor",
        notes: "Scanned from learner hostel QR during morning roll call.",
      },
      {
        id: "scan-2",
        learnerId: "learner-1",
        eventType: "CHECKED_IN_GATE",
        context: "HOSTEL_GATE",
        scannedAt: "2026-07-30T17:42:00.000Z",
        scannedBy: "Gate Control",
        notes: "Returned to hostel after sport practice.",
      },
    ],
    scanExceptions: [
      {
        id: "scan-exception-1",
        learnerId: "learner-1",
        eventType: "MEAL_DINNER",
        reason: "Duplicate dinner scan attempt blocked within duplicate protection window.",
        createdAt: "2026-07-30T18:05:00.000Z",
        createdBy: "Dining Hall",
      },
    ],
    meals: [{ id: "meal-1", mealDate: "2026-06-22", mealType: "BREAKFAST", plannedCount: 48, servedCount: 45 }],
    incidents: [{ id: "incident-1", learnerId: "learner-1", title: "Late lights-out", severity: "LOW", category: "Routine", status: "OPEN", occurredAt: "2026-06-20T20:30:00.000Z" }],
    maintenance: [{ id: "maintenance-1", title: "Window latch loose", source: "Hostel", buildingId: "hostel-building-1", priority: "MEDIUM", status: "OPEN", category: "Facilities", description: "Room A101 latch needs repair." }],
    visitors: [{ id: "visitor-1", learnerId: "learner-1", visitorName: "Sarah Khumalo", checkedInAt: "2026-06-21T14:00:00.000Z", status: "CHECKED_OUT" }],
    charges: [{ id: "charge-1", learnerId: "learner-1", description: "June hostel fee", billingPeriod: "2026-06", amount: 2500, paidAmount: 1000, dueDate: "2026-06-30", status: "PARTIAL" }],
    notices: [{ id: "notice-1", title: "Winter study hours", message: "Study hall starts at 18:30 this week.", createdAt: now() }],
  };

  const disciplinary = {
    records: [
      {
        id: "discipline-1",
        learnerId: "learner-1",
        title: "Late to assembly",
        category: "Attendance",
        severity: "LOW",
        status: "OPEN",
        description: "Arrived after final assembly bell.",
        actionTaken: "Warning issued and punctuality discussion recorded.",
        points: 1,
        parentVisible: true,
        requiresAcknowledgement: true,
        parentAcknowledgedAt: null,
        occurredAt: "2026-07-28T07:45:00.000Z",
        followUpAt: "2026-08-04T08:00:00.000Z",
        reportedBy: { name: "Operations Admin", email: "admin@popin.school" },
      },
      {
        id: "discipline-2",
        learnerId: "learner-2",
        title: "Homework dishonesty review",
        category: "Academic dishonesty",
        severity: "HIGH",
        status: "IN_REVIEW",
        description: "Copied a submitted English worksheet from another learner.",
        actionTaken: "Parent meeting requested and supervised resubmission assigned.",
        points: 4,
        parentVisible: true,
        requiresAcknowledgement: true,
        parentAcknowledgedAt: null,
        occurredAt: "2026-07-29T10:15:00.000Z",
        followUpAt: "2026-08-02T12:00:00.000Z",
        reportedBy: { name: "English Department", email: "teacher@popin.school" },
      },
    ],
  };

  const identityProviders = ["microsoft", "google", "apple"].map((provider) => ({
    id: `identity-${provider}`,
    provider,
    displayName: provider === "microsoft" ? "Microsoft 365 / Entra ID" : provider === "google" ? "Google Workspace" : "Sign in with Apple",
    tenantDomain: "",
    status: "NOT_CONFIGURED",
    credentialsConfigured: false,
    tokenHealth: "Not connected",
    lastSyncAt: null,
    lastError: "",
    settings: { allowedPortals: provider === "apple" ? ["parent"] : ["admin", "teacher", "parent"], autoCreateTeachers: false, autoCreateAdmins: false },
    roleMappings: [],
    syncLogs: [],
  }));

  const activity = [
    {
      id: "activity-1",
      user: "Sarah Khumalo",
      action: "approved requisition",
      target: "REQ-0001",
      time: "Today",
      avatar: "SK",
    },
    {
      id: "activity-2",
      user: "Assigned Teacher",
      action: "published homework for",
      target: "Grade 8 Mathematics",
      time: "Today",
      avatar: "TD",
    },
    {
      id: "activity-3",
      user: "Parent Representative",
      action: "reviewed learner conduct for",
      target: "Ari Khumalo",
      time: "Yesterday",
      avatar: "PD",
    },
  ];

  const notifications = [
    {
      id: "notif-1",
      type: "approval",
      title: "Approval Required",
      message: "A procurement workflow is waiting for review.",
      time: "Now",
      read: false,
    },
    {
      id: "notif-2",
      type: "ticket",
      title: "Ticket Queue Active",
      message: "A support ticket remains open for follow-up.",
      time: "Today",
      read: false,
    },
    {
      id: "notif-3",
      type: "appointment",
      title: "Parent Follow-up",
      message: "A parent acknowledgement is still outstanding.",
      time: "Today",
      read: true,
    },
  ];

  const communications = {
    audiences: [
      {
        id: "audience-all-families",
        name: "All families",
        type: "SYSTEM",
        filters: { roles: ["PARENT"], grades: [], classes: [], languages: [] },
        memberCount: guardianLinks.length,
      },
      {
        id: "audience-grade-8",
        name: "Grade 8 families",
        type: "GRADE",
        filters: { grades: ["grade-8"], classes: [], languages: [] },
        memberCount: guardianLinks.filter((link) => link.learnerId === "learner-1").length,
      },
    ],
    campaigns: [
      {
        id: "campaign-1",
        title: "Winter sports photo day",
        audienceId: "audience-all-families",
        status: "SENT",
        channels: ["APP", "EMAIL"],
        subject: "Winter sports photo day on Friday",
        content:
          "Learners participating in winter sports should arrive in full match kit for the official school photos.",
        scheduledFor: "2026-07-29T06:30:00.000Z",
        sentAt: "2026-07-29T06:30:00.000Z",
        createdAt: "2026-07-28T14:00:00.000Z",
        metrics: { recipients: 2, delivered: 2, opened: 1, failed: 0 },
      },
    ],
    resources: [
      {
        id: "resource-1",
        title: "Term 3 parent calendar",
        type: "DOCUMENT",
        category: "Calendar",
        audienceId: "audience-all-families",
        visibility: "PARENT_STUDENT",
        url: "/docs/term-3-calendar.pdf",
        updatedAt: "2026-07-27T10:00:00.000Z",
      },
    ],
    calendar: [
      {
        id: "calendar-1",
        title: "Inter-house athletics",
        category: "Event",
        location: "Main field",
        startsAt: "2026-08-18T08:00:00.000Z",
        endsAt: "2026-08-18T13:00:00.000Z",
        audienceId: "audience-all-families",
      },
    ],
    templates: [
      {
        id: "template-1",
        name: "General school notice",
        category: "Notice",
        subject: "School notice",
        content: "Dear families,\n\nPlease note the following school update.\n\nRegards,\nSchool office",
      },
    ],
    deliveryLogs: [
      {
        id: "delivery-log-1",
        campaignId: "campaign-1",
        channel: "EMAIL",
        audienceId: "audience-all-families",
        recipient: "parent@popin.school",
        recipientRole: "PARENT",
        status: "DELIVERED",
        provider: "RESEND",
        providerMessageId: "seed-message-1",
        openedAt: "2026-07-29T07:12:00.000Z",
        createdAt: "2026-07-29T06:30:00.000Z",
      },
    ],
  };

  const boards = [
    {
      id: "board-procurement",
      name: "Procurement Workflow",
      slug: "procurement",
      color: "#2563eb",
      columns: [
        {
          id: "board-procurement-backlog",
          title: "Backlog",
          color: "#64748b",
          cards: [
            {
              id: "card-procurement-1",
              title: "Review science lab starter kits",
              priority: "high",
              assignee: "Sarah Khumalo",
              tags: ["Procurement", "Approval"],
              comments: 2,
              attachments: 1,
              dueDate: "2026-08-05",
              description: "Validate supplier pricing and budget routing before sign-off.",
              activity: [],
            },
          ],
        },
        {
          id: "board-procurement-review",
          title: "In Review",
          color: "#f59e0b",
          cards: [
            {
              id: "card-procurement-2",
              title: "Approve uniform replenishment delivery",
              priority: "medium",
              assignee: "Assigned Teacher",
              tags: ["Uniform", "Receiving"],
              comments: 1,
              attachments: 0,
              dueDate: "2026-08-02",
              description: "Confirm intake plan for the next uniform delivery.",
              activity: [],
            },
          ],
        },
        {
          id: "board-procurement-done",
          title: "Done",
          color: "#16a34a",
          cards: [],
        },
      ],
    },
    {
      id: "board-parent",
      name: "Parent & Student Follow-up",
      slug: "parent-student",
      color: "#0f766e",
      columns: [
        {
          id: "board-parent-open",
          title: "Open",
          color: "#2563eb",
          cards: [
            {
              id: "card-parent-1",
              title: "Acknowledge learner conduct follow-up",
              priority: "high",
              assignee: "Parent Representative",
              tags: ["Parent Portal", "Discipline"],
              comments: 1,
              attachments: 0,
              dueDate: "2026-08-04",
              description: "Keep parent acknowledgements and learner follow-up actions visible.",
              activity: [],
            },
          ],
        },
        {
          id: "board-parent-progress",
          title: "In Progress",
          color: "#f59e0b",
          cards: [],
        },
        {
          id: "board-parent-done",
          title: "Completed",
          color: "#16a34a",
          cards: [],
        },
      ],
    },
  ];

  return {
    grades,
    subjects,
    classes,
    learners: learners.map((learner) => ({
      ...learner,
      guardians: guardianLinks.filter((link) => link.learnerId === learner.id),
      classHistory: [{ id: `history-${learner.id}`, changedAt: "2026-01-10T08:00:00.000Z", reason: "Initial placement" }],
    })),
    parent: {
      guardianEmail: guardian.email,
      guardianName: guardian.name,
      profile: {
        phone: "082 555 1100",
        alternatePhone: "011 555 0178",
        preferredChannel: "EMAIL",
        addressLine1: "14 Acacia Avenue",
        suburb: "Midrand",
        city: "Johannesburg",
      },
      settings: {
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        weeklyDigest: true,
        absenceAlerts: true,
        feeReminders: true,
        disciplineAlerts: true,
      },
      fees: [
        {
          id: "fee-1",
          learnerId: "learner-1",
          term: "Term 2",
          category: "Tuition",
          amount: 12500,
          paidAmount: 9000,
          dueDate: "2026-08-07",
          reference: "INV-2026-T2-ARI",
          status: "PARTIAL",
        },
        {
          id: "fee-2",
          learnerId: "learner-2",
          term: "Term 3",
          category: "Activities",
          amount: 2850,
          paidAmount: 0,
          dueDate: "2026-08-15",
          reference: "INV-2026-T3-MIL",
          status: "UNPAID",
        },
      ],
      payments: [
        {
          id: "payment-1",
          learnerId: "learner-1",
          feeId: "fee-1",
          amount: 4500,
          method: "EFT",
          reference: "EFT-887211",
          proofFileName: "proof-june.pdf",
          paidAt: "2026-06-10T08:00:00.000Z",
          status: "VERIFIED",
        },
        {
          id: "payment-2",
          learnerId: "learner-1",
          feeId: "fee-1",
          amount: 4500,
          method: "CARD",
          reference: "CARD-992001",
          paidAt: "2026-07-04T14:15:00.000Z",
          status: "VERIFIED",
        },
      ],
      paymentPlans: [
        {
          id: "payment-plan-1",
          learnerId: "learner-1",
          title: "Term 3 family arrangement",
          instalmentAmount: 1200,
          frequency: "MONTHLY",
          startDate: "2026-08-05",
          endDate: "2026-10-05",
          status: "ACTIVE",
          balance: 3600,
          notes: "Approved by finance office.",
        },
      ],
      attendance: [
        {
          id: "attendance-1",
          learnerId: "learner-1",
          date: "2026-07-27",
          status: "PRESENT",
          note: "",
          capturedBy: "Assigned Teacher",
          submittedAt: "2026-07-27T07:35:00.000Z",
        },
        {
          id: "attendance-2",
          learnerId: "learner-1",
          date: "2026-07-28",
          status: "LATE",
          note: "Arrived 8 minutes after register.",
          capturedBy: "Assigned Teacher",
          submittedAt: "2026-07-28T07:43:00.000Z",
        },
        {
          id: "attendance-3",
          learnerId: "learner-2",
          date: "2026-07-29",
          status: "ABSENT",
          note: "Medical appointment.",
          capturedBy: "Assigned Teacher",
          submittedAt: "2026-07-29T07:31:00.000Z",
        },
      ],
      appointments: [
        {
          id: "appointment-1",
          learnerId: "learner-1",
          teacherName: "Assigned Teacher",
          teacherEmail: "teacher@popin.school",
          title: "Mathematics progress meeting",
          startsAt: "2026-08-05T14:00:00.000Z",
          endsAt: "2026-08-05T14:30:00.000Z",
          location: "Grade 8 classroom",
          notes: "Discuss revision plan before the algebra test.",
          status: "CONFIRMED",
          createdBy: "Parent",
        },
      ],
      reports: [
        {
          id: "report-1",
          learnerId: "learner-1",
          term: "Term 2",
          average: 76,
          publishedAt: "2026-07-20T12:00:00.000Z",
          teacherComment: "Steady progress with good classroom participation.",
          subjects: [
            { name: "Mathematics", mark: 81, grade: "A" },
            { name: "Natural Sciences", mark: 74, grade: "B" },
            { name: "English", mark: 72, grade: "B" },
          ],
        },
        {
          id: "report-2",
          learnerId: "learner-2",
          term: "Term 2",
          average: 69,
          publishedAt: "2026-07-20T12:00:00.000Z",
          teacherComment: "Needs tighter homework routine, but oral participation is improving.",
          subjects: [
            { name: "English", mark: 78, grade: "B" },
            { name: "Mathematics", mark: 63, grade: "C" },
            { name: "Natural Sciences", mark: 66, grade: "C" },
          ],
        },
      ],
      messages: [
        {
          id: "thread-1",
          learnerId: "learner-1",
          subject: "Homework clarification",
          status: "OPEN",
          updatedAt: "2026-07-30T16:10:00.000Z",
          messages: [
            {
              id: "thread-1-msg-1",
              authorRole: "PARENT",
              authorName: "Sarah Khumalo",
              message: "Can you confirm whether the algebra task is due on Wednesday or Thursday?",
              createdAt: "2026-07-30T15:44:00.000Z",
            },
            {
              id: "thread-1-msg-2",
              authorRole: "TEACHER",
              authorName: "Assigned Teacher",
              message: "It is due on Thursday. I have also updated the class notice.",
              createdAt: "2026-07-30T16:10:00.000Z",
            },
          ],
        },
      ],
      notifications: [
        {
          id: "parent-notification-1",
          learnerId: "learner-1",
          type: "discipline",
          title: "Disciplinary acknowledgement needed",
          message: "A conduct item for Ari Khumalo needs your acknowledgement.",
          createdAt: "2026-07-29T10:30:00.000Z",
          readAt: null,
        },
        {
          id: "parent-notification-2",
          learnerId: "learner-2",
          type: "finance",
          title: "Fee reminder",
          message: "An activities invoice for Mila Khumalo is due on 15 August 2026.",
          createdAt: "2026-07-30T08:15:00.000Z",
          readAt: null,
        },
      ],
      orders: [
        {
          id: "parent-order-1",
          learnerId: "learner-1",
          status: "READY_FOR_COLLECTION",
          totalAmount: 1030,
          createdAt: "2026-06-21T10:00:00.000Z",
          collectionLocation: "School reception",
          items: [{ id: "line-1", name: "Grade 8 Blazer", quantity: 1 }],
        },
      ],
      tickets: [
        {
          id: "parent-ticket-1",
          learnerId: "learner-1",
          title: "Transport question",
          category: "Transport",
          priority: "MEDIUM",
          status: "OPEN",
          description: "Question about afternoon pickup.",
          createdAt: "2026-07-25T10:00:00.000Z",
          replies: [
            {
              id: "parent-ticket-1-reply-1",
              authorRole: "PARENT",
              authorName: "Sarah Khumalo",
              message: "Could you please confirm the Friday pickup point?",
              createdAt: "2026-07-25T10:00:00.000Z",
            },
          ],
        },
      ],
    },
    teacher: {
      profile: {
        department: "Mathematics and Sciences",
        phone: "082 444 2211",
        alternatePhone: "",
        room: "B12",
        bio: "Class teacher focused on clear routines, strong learner support, and parent communication.",
        notificationPreferences: {
          emailNotifications: true,
          inAppNotifications: true,
          parentMessageAlerts: true,
          attendanceReminders: true,
        },
      },
      dashboard: {
        today: classes.flatMap((item) => item.timetable),
        homeworkDueToday: classes.flatMap((item) => item.workItems).filter((item) => item.type === "HOMEWORK"),
        parentQueries: [{ id: "query-1", learnerId: "learner-1", subject: "Homework clarification", status: "OPEN", message: "Can you confirm the due date?" }],
        attendanceTasks: classes.map((item) => ({ id: `attendance-${item.id}`, classId: item.id, title: item.name })),
        lessonPlansIncomplete: classes.flatMap((item) => item.workItems).filter((item) => item.type === "LESSON_PLAN"),
        requisitions: [],
        announcements: [{ id: "announcement-1", title: "Science expo", status: "PUBLISHED", instructions: "Expo projects are due next Friday." }],
        teacherAssistant: { readyForReview: 1, needsAttention: 1 },
      },
    },
    applications: { forms: [applicationForm] },
    hostel,
    disciplinary,
    identityProviders,
    communications,
    activity,
    notifications,
    boards,
    teacherAssistant: {
      assessments: [
        {
          id: "assessment-1",
          name: "Grade 8 Algebra Test",
          subject: "Mathematics",
          assessmentType: "Test",
          classIds: ["class-8a"],
          gradeId: "grade-8",
          totalMarks: 50,
          dueAt: "2026-08-06T09:00:00.000Z",
          status: "PUBLISHED",
          resultsReleasedAt: null,
          counts: { total: 2, ready: 0, needsReview: 0 },
          scripts: [
            {
              id: "script-1",
              learnerId: "learner-1",
              status: "PUBLISHED",
              extractedText: "Learner: Ari Khumalo\n1. 15\n2. 12\n3. 9",
              ocrConfidence: 0.94,
              markingConfidence: 0.91,
              suggestedTotal: 42,
              finalTotal: 42,
              flags: [],
              createdAt: "2026-07-30T10:00:00.000Z",
              results: [
                { id: "result-1", questionNumber: "1", expectedAnswer: ["15"], detectedAnswer: "15", matchingRule: "Exact match", suggestedMarks: 15, finalMarks: 15 },
                { id: "result-2", questionNumber: "2", expectedAnswer: ["12"], detectedAnswer: "12", matchingRule: "Exact match", suggestedMarks: 12, finalMarks: 12 },
                { id: "result-3", questionNumber: "3", expectedAnswer: ["15"], detectedAnswer: "9", matchingRule: "Teacher-adjusted", suggestedMarks: 9, finalMarks: 15 },
              ],
            },
            {
              id: "script-2",
              learnerId: "learner-2",
              status: "PUBLISHED",
              extractedText: "Learner: Mila Khumalo\n1. 13\n2. 10\n3. 8",
              ocrConfidence: 0.92,
              markingConfidence: 0.88,
              suggestedTotal: 31,
              finalTotal: 31,
              flags: [],
              createdAt: "2026-07-30T10:10:00.000Z",
              results: [
                { id: "result-4", questionNumber: "1", expectedAnswer: ["15"], detectedAnswer: "13", matchingRule: "Teacher-adjusted", suggestedMarks: 13, finalMarks: 13 },
                { id: "result-5", questionNumber: "2", expectedAnswer: ["12"], detectedAnswer: "10", matchingRule: "Teacher-adjusted", suggestedMarks: 10, finalMarks: 10 },
                { id: "result-6", questionNumber: "3", expectedAnswer: ["8"], detectedAnswer: "8", matchingRule: "Exact match", suggestedMarks: 8, finalMarks: 8 },
              ],
            },
          ],
          questions: [
            { questionNumber: "1", questionType: "NUMERICAL", expectedAnswers: ["15"], marks: 15 },
            { questionNumber: "2", questionType: "NUMERICAL", expectedAnswers: ["12"], marks: 15 },
            { questionNumber: "3", questionType: "NUMERICAL", expectedAnswers: ["8"], marks: 20 },
          ],
        },
      ],
    },
  };
}

export async function getPortalData() {
  return getSetting<PortalData>("portal-data", defaultPortalData());
}

export async function savePortalData(data: PortalData) {
  await putSetting("portal-data", data);
  return data;
}

export function uid(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export function learnerName(data: PortalData, learnerId: string) {
  const learner = data.learners.find((item) => item.id === learnerId);
  return learner ? `${learner.firstName} ${learner.lastName}` : "Learner";
}

export function buildDisciplineOverview(data: PortalData) {
  const records = (data.disciplinary?.records || []).map((record: any) => {
    const learner = data.learners.find((item) => item.id === record.learnerId);
    return {
      ...record,
      learner,
      learnerName: learner ? `${learner.firstName} ${learner.lastName}` : "Learner",
      studentNumber: learner?.studentNumber || "",
      guardians: learner?.guardians || [],
    };
  });

  return {
    items: records,
    stats: {
      open: records.filter((item: any) => item.status === "OPEN").length,
      resolved: records.filter((item: any) => item.status === "RESOLVED").length,
      awaitingAcknowledgement: records.filter(
        (item: any) => item.parentVisible && item.requiresAcknowledgement && !item.parentAcknowledgedAt,
      ).length,
      highSeverity: records.filter((item: any) => ["HIGH", "CRITICAL"].includes(item.severity)).length,
    },
  };
}

export function buildHostelOverview(data: PortalData) {
  const learners = data.learners;
  const buildings = data.hostel.buildings.map((building) => ({
    ...building,
    blocks: building.blocks.map((block) => ({
      ...block,
      rooms: block.rooms.map((room) => ({
        ...room,
        beds: room.beds.map((bed) => ({
          ...bed,
          status: data.hostel.allocations.some((allocation) => allocation.bedId === bed.id && ["RESERVED", "CHECKED_IN"].includes(allocation.status)) ? "OCCUPIED" : bed.status,
        })),
      })),
    })),
  }));
  const bedIndex = new Map<string, any>();
  for (const building of buildings) {
    for (const block of building.blocks) {
      for (const room of block.rooms) {
        for (const bed of room.beds) bedIndex.set(bed.id, { ...bed, room: { ...room, block: { ...block, building } } });
      }
    }
  }
  return {
    learners,
    buildings,
    applications: data.hostel.applications.map((item) => ({
      ...item,
      learner: learners.find((learner) => learner.id === item.learnerId),
      preferredBuilding: buildings.find((building) => building.id === item.preferredBuildingId),
    })),
    allocations: data.hostel.allocations.map((item) => ({
      ...item,
      learner: learners.find((learner) => learner.id === item.learnerId),
      bed: bedIndex.get(item.bedId),
    })),
    rollCalls: data.hostel.rollCalls,
    meals: data.hostel.meals,
    incidents: data.hostel.incidents,
    maintenance: data.hostel.maintenance,
    visitors: data.hostel.visitors,
    charges: data.hostel.charges,
    payments: (data.hostel as any).payments || [],
    notices: data.hostel.notices,
    scanEvents: (data.hostel.scanEvents || []).map((item) => ({
      ...item,
      learner: learners.find((learner) => learner.id === item.learnerId),
    })),
    scanExceptions: (data.hostel.scanExceptions || []).map((item) => ({
      ...item,
      learner: learners.find((learner) => learner.id === item.learnerId),
    })),
    qrPasses: data.hostel.qrPasses || [],
  };
}

export function buildHostelDashboard(data: PortalData) {
  const overview = buildHostelOverview(data);
  const beds = overview.buildings.flatMap((building: any) => building.blocks.flatMap((block: any) => block.rooms.flatMap((room: any) => room.beds)));
  const occupied = overview.allocations.filter((item: any) => ["RESERVED", "CHECKED_IN"].includes(item.status)).length;
  return {
    capacity: beds.length,
    occupied,
    available: Math.max(beds.length - occupied, 0),
    pendingApplications: data.hostel.applications.filter((item) => item.status === "PENDING").length,
    waitingList: data.hostel.applications.filter((item) => item.status === "WAITLISTED").length,
    outstandingFees: data.hostel.charges.reduce((sum, item) => sum + item.amount - item.paidAmount, 0),
    checkIns: data.hostel.allocations.filter((item) => item.status === "CHECKED_IN").length,
    checkOuts: data.hostel.allocations.filter((item) => item.status === "CHECKED_OUT").length,
    mealAttendance: data.hostel.meals[0]?.servedCount || 0,
    incidentsThisWeek: data.hostel.incidents.length,
    openMaintenance: data.hostel.maintenance.filter((item) => item.status !== "RESOLVED").length,
  };
}
