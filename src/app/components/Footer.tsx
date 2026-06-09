import { Zap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[#E2E8F0] py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#2563EB] rounded-md flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600 }} className="text-[#0F172A]">guara</span>
        </div>
        <p style={{ fontSize: '13px' }} className="text-[#94A3B8]">© 2026 Guara. DORA-compliant vendor risk intelligence.</p>
        <div className="flex gap-5">
          {['Privacy', 'Terms', 'Security'].map((l) => (
            <a key={l} href="#" style={{ fontSize: '13px' }} className="text-[#94A3B8] hover:text-[#64748B] transition-colors">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
