"use client";

import {
  BASE_INPUT,
  borderCls,
  type InputSubProps,
} from "@/components/ui/DynamicFormTypes";

export const SelectInput = ({
  field,
  value,
  describedBy,
  error,
  onChange,
}: InputSubProps) => {
  return (
    <select
      id={field.id}
      value={value}
      onChange={(e) => onChange(field.name, e.target.value)}
      aria-describedby={describedBy}
      className={`${BASE_INPUT} ${borderCls(Boolean(error))}`}
    >
      <option value="">Select…</option>
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
