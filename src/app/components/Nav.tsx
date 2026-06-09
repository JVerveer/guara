import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function Nav() {
  const { appState, startSample } = useApp();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#2563EB] rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontSize: '17px', fontWeight: 600 }} className="text-[#0F172A] tracking-tight">guara</span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {[
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Security', href: '#security' },
            { label: 'FAQ', href: '#faq' },
          ].map(({ label, href }) => (
            <a key={label} href={href} style={{ fontSize: '14px' }} className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              {label}
            </a>
          ))}
          <span style={{ fontSize: '14px' }} className="text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer">Sign In</span>
          {appState === 'idle' && (
            <button
              onClick={startSample}
              className="bg-[#2563EB] text-white px-4 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-colors"
              style={{ fontSize: '13px', fontWeight: 600 }}
            >
              Try Sample
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
