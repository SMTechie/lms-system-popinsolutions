import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Wrench } from 'lucide-react';

interface PlaceholderProps {
  title: string;
}

export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <DashboardLayout title={title}>
      <div className="flex flex-col items-center justify-center min-h-96 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <Wrench className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 font-heading mb-2">Coming Soon</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          This module is under construction. Use Meku to generate content for this page.
        </p>
      </div>
    </DashboardLayout>
  );
}