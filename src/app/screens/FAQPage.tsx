import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '../data/constants';

export function FAQPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-[#2563EB] uppercase mb-2">Help</p>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#0F172A] mb-2">Frequently asked questions</h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6 }} className="text-[#64748B]">Everything you need to know about Guara.</p>
        </div>

        <div className="space-y-2">
          {FAQS.map(({ q, a }, i) => (
            <div key={q} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
              >
                <span style={{ fontSize: '14px', fontWeight: 500 }} className="text-[#0F172A] pr-4">{q}</span>
                <ChevronDown className={`w-4 h-4 text-[#94A3B8] flex-shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-4 border-t border-[#F1F5F9]">
                  <p style={{ fontSize: '13px', lineHeight: 1.7 }} className="text-[#64748B] pt-3">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-center">
          <p style={{ fontSize: '13px' }} className="text-[#64748B]">Still have questions?</p>
          <p style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#2563EB] mt-0.5 cursor-pointer hover:underline">hello@guara.io</p>
        </div>
      </div>
    </div>
  );
}
