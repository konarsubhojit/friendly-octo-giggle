"use client";

import {
  BASE_INPUT,
  borderCls,
  type InputSubProps,
} from "@/components/ui/DynamicFormTypes";

export function TextareaInput({
  field,
  value,
  describedBy,
  error,
  onChange,
}: InputSubProps) {
  return (
    <textarea
      id={field.id}
      name={field.name}
      value={value}
      onChange={(e) => onChange(field.name, e.target.value)}
      rows={field.rows ?? 4}
      placeholder={field.placeholder}
      autoComplete={field.autoComplete}
      aria-describedby={describedBy}
      className={`${BASE_INPUT} resize-none ${borderCls(Boolean(error))}`}
    />
  );
}
