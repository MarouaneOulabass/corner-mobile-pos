'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Input } from './Input';
import { Button } from './Button';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), q, 1);
}

function endOfQuarter(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3) * 3 + 2;
  return new Date(date.getFullYear(), q + 1, 0);
}

const presets: { label: string; getRange: () => DateRange }[] = [
  {
    label: "Aujourd'hui",
    getRange: () => {
      const today = toISODate(new Date());
      return { from: today, to: today };
    },
  },
  {
    label: 'Cette semaine',
    getRange: () => ({
      from: toISODate(startOfWeek(new Date())),
      to: toISODate(new Date()),
    }),
  },
  {
    label: 'Ce mois',
    getRange: () => ({
      from: toISODate(startOfMonth(new Date())),
      to: toISODate(new Date()),
    }),
  },
  {
    label: 'Dernier trimestre',
    getRange: () => {
      const now = new Date();
      const prevQ = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return {
        from: toISODate(startOfQuarter(prevQ)),
        to: toISODate(endOfQuarter(prevQ)),
      };
    },
  },
  {
    label: 'Cet exercice',
    getRange: () => ({
      from: toISODate(new Date(new Date().getFullYear(), 0, 1)),
      to: toISODate(new Date()),
    }),
  },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Du</label>
          <Input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Au</label>
          <Input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => onChange(preset.getRange())}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
