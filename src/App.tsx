'use client';

import React, { Suspense, lazy } from 'react';
import '@radix-ui/themes/styles.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './views/Home';
import NotFound from './views/NotFound';
import Login from './views/Login';
import RequireAuth from './auth/RequireAuth';
import { AuthProvider } from './auth/AuthContext';
import { BrandingProvider } from './settings/BrandingContext';
import AppDocumentTitle from './components/AppDocumentTitle';
import PwaRegistration from './components/PwaRegistration';
import BrandFavicon from './components/BrandFavicon';

const Boards = lazy(() => import('./views/Boards'));
const Analytics = lazy(() => import('./views/Analytics'));
const AIAssist = lazy(() => import('./views/AIAssist'));
const Payments = lazy(() => import('./views/Payments'));
const Store = lazy(() => import('./views/Store'));
const Discipline = lazy(() => import('./views/Discipline'));
const Communications = lazy(() => import('./views/Communications'));
const ParentPortal = lazy(() => import('./views/ParentPortal'));
const ParentPaymentCallback = lazy(() => import('./views/ParentPaymentCallback'));
const StudentPortal = lazy(() => import('./views/StudentPortal'));
const TeacherPortal = lazy(() => import('./views/TeacherPortal'));
const Settings = lazy(() => import('./views/Settings'));
const Admissions = lazy(() => import('./views/Admissions'));
const Enquiries = lazy(() => import('./views/Enquiries'));
const ApplicationFormBuilder = lazy(() => import('./views/ApplicationFormBuilder'));
const ApplicationsPublic = lazy(() => import('./views/ApplicationsPublic'));
const Tickets = lazy(() => import('./views/Tickets'));
const Inventory = lazy(() => import('./views/Inventory'));
const Requisitions = lazy(() => import('./views/Requisitions'));
const RequisitionDetail = lazy(() => import('./views/RequisitionDetail'));
const RequisitionCreate = lazy(() => import('./views/RequisitionCreate'));
const SupplyChain = lazy(() => import('./views/SupplyChain'));
const Students = lazy(() => import('./views/Students'));
const IdentityIntegrations = lazy(() => import('./views/IdentityIntegrations'));
const Hostel = lazy(() => import('./views/Hostel'));
const WebsiteMaintenance = lazy(() => import('./views/WebsiteMaintenance'));
const SchoolWebsite = lazy(() => import('./views/SchoolWebsite'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrandingProvider>
        <Router>
          <AppDocumentTitle />
          <BrandFavicon />
          <PwaRegistration />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Login />} />
              <Route path="/applications/new" element={<ApplicationsPublic />} />
              <Route path="/school-website/*" element={<SchoolWebsite />} />
              <Route element={<RequireAuth />}>
                <Route element={<RequireAuth allowedRoles={['ADMIN', 'PARENT']} />}>
                  <Route path="/store" element={<Store />} />
                </Route>
                <Route element={<RequireAuth allowedRoles={['ADMIN', 'PARENT']} />}>
                  <Route path="/parent-portal" element={<ParentPortal />} />
                  <Route path="/parent-portal/payment-callback" element={<ParentPaymentCallback />} />
                </Route>
                <Route element={<RequireAuth allowedRoles={['ADMIN', 'STUDENT']} />}>
                  <Route path="/student-portal" element={<StudentPortal />} />
                </Route>
                <Route element={<RequireAuth allowedRoles={['ADMIN', 'TEACHER']} />}>
                  <Route element={<RequireAuth allowedRoles={['ADMIN']} />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/boards" element={<Boards />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/ai-assist" element={<AIAssist />} />
                  <Route element={<RequireAuth allowedRoles={['ADMIN']} />}>
                    <Route path="/website" element={<WebsiteMaintenance />} />
                  </Route>
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/requisitions" element={<Requisitions />} />
                  <Route path="/requisitions/new" element={<RequisitionCreate />} />
                  <Route path="/requisitions/:id" element={<RequisitionDetail />} />
                  <Route path="/supply-chain" element={<SupplyChain />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/admissions" element={<Admissions />} />
                  <Route path="/enquiries" element={<Enquiries />} />
                  <Route path="/hostel" element={<Hostel />} />
                  <Route path="/admissions/form-builder" element={<ApplicationFormBuilder />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/identity-integrations" element={<IdentityIntegrations />} />
                  </Route>
                  <Route element={<RequireAuth allowedRoles={['ADMIN', 'TEACHER']} />}>
                  <Route path="/communications" element={<Communications />} />
                  <Route path="/tickets" element={<Tickets />} />
                  <Route path="/discipline" element={<Discipline />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/teacher-portal" element={<TeacherPortal />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            newestOnTop
            closeOnClick
            pauseOnHover
          />
        </Router>
      </BrandingProvider>
    </AuthProvider>
  );
};

export default App;
