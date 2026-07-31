export const mockStats = {
  openTasks: 47,
  ticketsOpen: 23,
  storeSalesToday: 12450,
  outstandingFees: 284300,
  admissionsPipeline: 156,
  pendingApprovals: 8,
  lowStockAlerts: 5,
};

export const mockBoards = [
  { id: '1', name: 'Maintenance Requests', color: '#3B82F6', cards: 12, members: 4 },
  { id: '2', name: 'IT Support', color: '#8B5CF6', cards: 8, members: 3 },
  { id: '3', name: 'HR Onboarding', color: '#10B981', cards: 5, members: 6 },
  { id: '4', name: 'Procurement', color: '#F59E0B', cards: 19, members: 5 },
  { id: '5', name: 'Events Planning', color: '#EF4444', cards: 7, members: 8 },
];

export const mockColumns = [
  {
    id: 'backlog',
    title: 'Backlog',
    color: '#6B7280',
    cards: [
      { id: 'c1', title: 'Replace broken projector in Room 12', priority: 'high', assignee: 'John M.', tags: ['IT', 'Urgent'], comments: 3, attachments: 1, dueDate: '2026-02-15' },
      { id: 'c2', title: 'Order new lab equipment', priority: 'medium', assignee: 'Sarah K.', tags: ['Procurement'], comments: 1, attachments: 0, dueDate: '2026-02-20' },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    color: '#3B82F6',
    cards: [
      { id: 'c3', title: 'Staff ID card printing batch', priority: 'medium', assignee: 'Mike T.', tags: ['HR', 'Admin'], comments: 5, attachments: 2, dueDate: '2026-02-10' },
      { id: 'c4', title: 'Network upgrade in Block B', priority: 'high', assignee: 'John M.', tags: ['IT'], comments: 8, attachments: 3, dueDate: '2026-02-12' },
      { id: 'c5', title: 'Uniform stock count Q1', priority: 'low', assignee: 'Lisa P.', tags: ['Store'], comments: 2, attachments: 0, dueDate: '2026-02-18' },
    ],
  },
  {
    id: 'review',
    title: 'In Review',
    color: '#F59E0B',
    cards: [
      { id: 'c6', title: 'Annual budget proposal 2026', priority: 'high', assignee: 'Sarah K.', tags: ['Finance'], comments: 12, attachments: 5, dueDate: '2026-02-08' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    color: '#10B981',
    cards: [
      { id: 'c7', title: 'Parent portal email templates', priority: 'low', assignee: 'Lisa P.', tags: ['Portal'], comments: 4, attachments: 1, dueDate: '2026-02-05' },
      { id: 'c8', title: 'Term 1 timetable published', priority: 'medium', assignee: 'Mike T.', tags: ['Admin'], comments: 2, attachments: 2, dueDate: '2026-02-01' },
    ],
  },
];

export const mockActivity = [
  { id: '1', user: 'Sarah K.', action: 'approved requisition', target: 'Lab Equipment Order #REQ-0042', time: '5 min ago', avatar: 'SK' },
  { id: '2', user: 'John M.', action: 'commented on', target: 'Network upgrade in Block B', time: '12 min ago', avatar: 'JM' },
  { id: '3', user: 'Lisa P.', action: 'moved card to Done', target: 'Parent portal email templates', time: '34 min ago', avatar: 'LP' },
  { id: '4', user: 'Mike T.', action: 'created ticket', target: 'Broken AC in Staff Room', time: '1 hr ago', avatar: 'MT' },
  { id: '5', user: 'Admin', action: 'added new student', target: 'Admissions: Thabo Nkosi', time: '2 hr ago', avatar: 'AD' },
  { id: '6', user: 'Sarah K.', action: 'updated inventory', target: 'Grade 8 Blazers — 45 units', time: '3 hr ago', avatar: 'SK' },
];

export const mockNotifications = [
  { id: '1', type: 'approval', title: 'Approval Required', message: 'Requisition #REQ-0045 needs your sign-off', time: '2 min ago', read: false },
  { id: '2', type: 'ticket', title: 'Ticket Updated', message: 'Ticket #TKT-0089 status changed to In Progress', time: '15 min ago', read: false },
  { id: '3', type: 'order', title: 'Order Shipped', message: 'Store order #ORD-0234 has been dispatched', time: '1 hr ago', read: false },
  { id: '4', type: 'fee', title: 'Fee Reminder Sent', message: '42 parents notified of outstanding fees', time: '3 hr ago', read: true },
  { id: '5', type: 'appointment', title: 'New Appointment', message: 'Parent meeting scheduled for tomorrow 10:00', time: '5 hr ago', read: true },
];

export const mockUsers = [
  { id: '1', name: 'Sarah Khumalo', email: 'sarah.k@school.edu', role: 'Principal', status: 'active', lastLogin: '2026-02-07', avatar: 'SK' },
  { id: '2', name: 'John Mokoena', email: 'john.m@school.edu', role: 'IT Manager', status: 'active', lastLogin: '2026-02-07', avatar: 'JM' },
  { id: '3', name: 'Lisa Pietersen', email: 'lisa.p@school.edu', role: 'Store Manager', status: 'active', lastLogin: '2026-02-06', avatar: 'LP' },
  { id: '4', name: 'Mike Tshwane', email: 'mike.t@school.edu', role: 'Admin Officer', status: 'active', lastLogin: '2026-02-05', avatar: 'MT' },
  { id: '5', name: 'Nomsa Dlamini', email: 'nomsa.d@school.edu', role: 'Finance Officer', status: 'inactive', lastLogin: '2026-01-28', avatar: 'ND' },
  { id: '6', name: 'Peter van Wyk', email: 'peter.v@school.edu', role: 'Teacher', status: 'active', lastLogin: '2026-02-07', avatar: 'PV' },
];

export const mockProducts = [
  { id: '1', name: 'Grade 8 Blazer', category: 'Blazers', price: 850, stock: 23, image: 'https://placehold.co/400x400' },
  { id: '2', name: 'School Shirt (Boys)', category: 'Shirts', price: 180, stock: 67, image: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=400&fit=crop' },
  { id: '3', name: 'School Skirt (Girls)', category: 'Skirts', price: 220, stock: 45, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop' },
  { id: '4', name: 'Sports Shorts', category: 'Sports', price: 150, stock: 89, image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop' },
  { id: '5', name: 'School Bag', category: 'Accessories', price: 450, stock: 12, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop' },
  { id: '6', name: 'Grade 9 Blazer', category: 'Blazers', price: 850, stock: 8, image: 'https://placehold.co/400x400' },
];

export const mockAdmissions = [
  { id: '1', name: 'Thabo Nkosi', grade: 'Grade 8', stage: 'Application', date: '2026-02-01', status: 'pending' },
  { id: '2', name: 'Amahle Zulu', grade: 'Grade 10', stage: 'Assessment', date: '2026-01-28', status: 'in-progress' },
  { id: '3', name: 'Liam Botha', grade: 'Grade 8', stage: 'Interview', date: '2026-01-25', status: 'in-progress' },
  { id: '4', name: 'Priya Naidoo', grade: 'Grade 9', stage: 'Offer', date: '2026-01-20', status: 'approved' },
  { id: '5', name: 'James Steyn', grade: 'Grade 11', stage: 'Enrolled', date: '2026-01-15', status: 'approved' },
];

export const revenueData = [
  { month: 'Aug', revenue: 45000, fees: 280000 },
  { month: 'Sep', revenue: 52000, fees: 265000 },
  { month: 'Oct', revenue: 48000, fees: 290000 },
  { month: 'Nov', revenue: 61000, fees: 275000 },
  { month: 'Dec', revenue: 38000, fees: 240000 },
  { month: 'Jan', revenue: 55000, fees: 310000 },
  { month: 'Feb', revenue: 67000, fees: 295000 },
];

export const ticketData = [
  { name: 'IT', value: 34, color: '#3B82F6' },
  { name: 'Maintenance', value: 28, color: '#F59E0B' },
  { name: 'HR', value: 15, color: '#10B981' },
  { name: 'Finance', value: 12, color: '#8B5CF6' },
  { name: 'Other', value: 11, color: '#6B7280' },
];

export const admissionsFunnelData = [
  { stage: 'Enquiries', count: 312 },
  { stage: 'Applications', count: 198 },
  { stage: 'Assessments', count: 145 },
  { stage: 'Interviews', count: 98 },
  { stage: 'Offers', count: 72 },
  { stage: 'Enrolled', count: 61 },
];