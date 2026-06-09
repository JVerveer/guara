import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '../data/constants';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-[#2563EB] uppercase mb-3">Questions</p>
          <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#0F172A]">Frequently asked questions</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map(({ q, a }, i) => (
            <div key={q} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
              >
                <span style={{ fontSize: '15px', fontWeight: 500 }} className="text-[#0F172A]">{q}</span>
                <ChevronDown className={`w-4 h-4 text-[#94A3B8] flex-shrink-0 ml-4 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-4 border-t border-[#F1F5F9]">
                  <p style={{ fontSize: '14px', lineHeight: 1.7 }} className="text-[#64748B] pt-3">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
