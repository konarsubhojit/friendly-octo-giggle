"use client";

import { useState, useCallback } from "react";
import {
  DynamicForm,
  type FieldDef,
  type SubmitResult,
} from "@/components/ui/DynamicForm";

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const CONTACT_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: "contact-name",
    name: "name",
    label: "Name",
    type: "text",
    placeholder: "Your name",
    validate: (v) =>
      v.trim() ? undefined : "Tell us your name so we know how to address you.",
  },
  {
    id: "contact-email",
    name: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.com",
    validate: (v) => {
      if (!v.trim()) return "Enter the email address where we should reply.";
      if (!EMAIL_RE.test(v))
        return "Enter a valid email address, like you@example.com.";
      return undefined;
    },
  },
  {
    id: "contact-subject",
    name: "subject",
    label: "Subject",
    type: "select",
    options: [
      { value: "order", label: "Order Inquiry" },
      { value: "return", label: "Return / Refund" },
      { value: "shipping", label: "Shipping Question" },
      { value: "product", label: "Product Question" },
      { value: "other", label: "Other" },
    ],
    validate: (v) =>
      v ? undefined : "Choose the topic that best matches your message.",
  },
  {
    id: "contact-message",
    name: "message",
    label: "Message",
    type: "textarea",
    rows: 5,
    placeholder: "How can we help you?",
    validate: (v) =>
      v.trim()
        ? undefined
        : "Share a few details so our team can help you faster.",
  },
];

const SUBMIT_BTN =
  "w-full bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white py-3 rounded-full font-semibold hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] transition-all duration-300 shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed focus-warm";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback((): SubmitResult => {
    setSubmitted(true);
    return undefined;
  }, []);

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Message Sent!
        </h2>
        <p className="text-[var(--text-muted)]">
          Thank you for reaching out. We&apos;ll get back to you within 24
          hours.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-6 text-[var(--accent-rose)] hover:text-[var(--accent-pink)] font-medium text-sm"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6">
        Send a Message
      </h2>
      <DynamicForm
        fields={CONTACT_FIELDS}
        onSubmit={handleSubmit}
        submitLabel="Send Message"
        submitButtonClassName={SUBMIT_BTN}
        formClassName="space-y-5"
      />
    </>
  );
}
