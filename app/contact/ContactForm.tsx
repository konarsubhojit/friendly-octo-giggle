'use client';

import { useState } from 'react';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const INITIAL_STATE: FormState = { name: '', email: '', subject: '', message: '' };

export default function ContactForm() {
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function validate(): boolean {
    const newErrors: Partial<FormState> = {};
    if (!formState.name.trim()) newErrors.name = 'Name is required';
    if (!formState.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) newErrors.email = 'Enter a valid email';
    if (!formState.subject) newErrors.subject = 'Please select a subject';
    if (!formState.message.trim()) newErrors.message = 'Message is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h2>
        <p className="text-gray-500">Thank you for reaching out. We&apos;ll get back to you within 24 hours.</p>
        <button
          onClick={() => { setSubmitted(false); setFormState(INITIAL_STATE); setErrors({}); }}
          className="mt-6 text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Send a Message</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            value={formState.name}
            onChange={handleChange}
            placeholder="Your name"
            aria-describedby={errors.name ? 'name-error' : undefined}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors.name && <p id="name-error" className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formState.email}
            onChange={handleChange}
            placeholder="you@example.com"
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors.email && <p id="email-error" className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
        <select
          id="subject"
          name="subject"
          value={formState.subject}
          onChange={handleChange}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
          className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.subject ? 'border-red-400' : 'border-gray-200'}`}
        >
          <option value="">Select a subject</option>
          <option value="order">Order Inquiry</option>
          <option value="return">Return / Refund</option>
          <option value="shipping">Shipping Question</option>
          <option value="product">Product Question</option>
          <option value="other">Other</option>
        </select>
        {errors.subject && <p id="subject-error" className="text-xs text-red-600 mt-1">{errors.subject}</p>}
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={formState.message}
          onChange={handleChange}
          placeholder="How can we help you?"
          aria-describedby={errors.message ? 'message-error' : undefined}
          className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${errors.message ? 'border-red-400' : 'border-gray-200'}`}
        />
        {errors.message && <p id="message-error" className="text-xs text-red-600 mt-1">{errors.message}</p>}
      </div>
      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg"
      >
        Send Message
      </button>
    </form>
  );
}
