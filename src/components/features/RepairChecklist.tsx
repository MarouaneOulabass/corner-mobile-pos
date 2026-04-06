'use client';

import { useState } from 'react';
import { ChecklistTemplate, ChecklistItem } from '@/types';

interface RepairChecklistProps {
  template: ChecklistTemplate;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  readOnly?: boolean;
}

function getStatusColor(item: ChecklistItem, value: string): string {
  if (!value || value === '') return 'border-gray-200';

  if (item.type === 'boolean') {
    return value === 'true' || value === 'ok' || value === 'oui'
      ? 'border-green-400 bg-green-50'
      : 'border-red-400 bg-red-50';
  }

  if (item.type === 'select' && item.options) {
    const idx = item.options.indexOf(value);
    if (idx === 0) return 'border-green-400 bg-green-50';
    if (idx === item.options.length - 1) return 'border-red-400 bg-red-50';
    return 'border-orange-400 bg-orange-50';
  }

  return 'border-gray-200';
}

function ChecklistItemRow({
  item,
  value,
  onValueChange,
  readOnly,
}: {
  item: ChecklistItem;
  value: string;
  onValueChange: (val: string) => void;
  readOnly?: boolean;
}) {
  const colorClass = getStatusColor(item, value);

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${colorClass} transition-colors`}>
      <label className="text-sm font-medium text-gray-700 flex-1 mr-3">
        {item.label}
      </label>

      {item.type === 'boolean' && (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            if (readOnly) return;
            const next = value === 'true' ? 'false' : 'true';
            onValueChange(next);
          }}
          className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${
            value === 'true'
              ? 'bg-green-500'
              : value === 'false'
              ? 'bg-red-400'
              : 'bg-gray-300'
          } ${readOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform ${
              value === 'true' ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      )}

      {item.type === 'select' && (
        <select
          value={value || ''}
          disabled={readOnly}
          onChange={(e) => onValueChange(e.target.value)}
          className={`text-sm rounded-lg border border-gray-300 px-2 py-1.5 min-w-[120px] ${
            readOnly ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'bg-white'
          }`}
        >
          <option value="">-- Choisir --</option>
          {item.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {item.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          disabled={readOnly}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Saisir..."
          className={`text-sm rounded-lg border border-gray-300 px-2 py-1.5 w-40 ${
            readOnly ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'bg-white'
          }`}
        />
      )}
    </div>
  );
}

export default function RepairChecklist({
  template,
  values,
  onChange,
  readOnly = false,
}: RepairChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleItemChange = (key: string, val: string) => {
    onChange({ ...values, [key]: val });
  };

  const filledCount = template.items.filter((it) => {
    const v = values[it.key];
    return v !== undefined && v !== '';
  }).length;

  const progress = template.items.length > 0
    ? Math.round((filledCount / template.items.length) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">
            {collapsed ? '\u25B6' : '\u25BC'}
          </span>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
            <p className="text-xs text-gray-500">
              {filledCount}/{template.items.length} elements
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: progress === 100 ? '#22c55e' : '#2AA8DC',
              }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500">{progress}%</span>
        </div>
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {template.items.map((item) => (
            <ChecklistItemRow
              key={item.key}
              item={item}
              value={values[item.key] || ''}
              onValueChange={(val) => handleItemChange(item.key, val)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
