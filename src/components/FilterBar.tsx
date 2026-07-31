import React, { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';

interface FilterOption {
  label: string;
  options: string[];
}

interface FilterBarProps {
  filters: FilterOption[];
  onFilterChange?: (filter: string, value: string) => void;
}

export default function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const handleSelect = (filterLabel: string, value: string) => {
    const newSelected = { ...selected, [filterLabel]: value };
    setSelected(newSelected);
    setOpenFilter(null);
    onFilterChange?.(filterLabel, value);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Filter className="w-3.5 h-3.5" />
        <span>Filter:</span>
      </div>
      {filters.map(filter => (
        <div key={filter.label} className="relative">
          <button
            onClick={() => setOpenFilter(openFilter === filter.label ? null : filter.label)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all duration-200"
          >
            <span className="text-gray-600">{filter.label}:</span>
            <span className="text-gray-900">{selected[filter.label] || 'All'}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {openFilter === filter.label && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
              <button
                onClick={() => handleSelect(filter.label, '')}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                All
              </button>
              {filter.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSelect(filter.label, opt)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${selected[filter.label] === opt ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}