import { Lock, Shield, Trash2, Award, Eye, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const POINTS: { icon: LucideIcon; label: string; desc: string }[] = [
  { icon: Lock, label: 'Encrypted in transit', desc: 'TLS 1.3 for all data transfer.' },
  { icon: Shield, label: 'Encrypted at rest', desc: 'AES-256 storage encryption.' },
  { icon: Trash2, label: 'Automatic deletion', desc: 'Set documents to auto-delete post-analysis.' },
  { icon: Award, label: 'SOC2-ready architecture', desc: 'Built on SOC 2 compliant infrastructure.' },
  { icon: Eye, label: 'No model training', desc: 'Your documents never train AI models.' },
  { icon: CheckCircle2, label: 'Enterprise-grade security', desc: 'Role-based access and audit logs.' },
];

export function Security() {
  return (
    <section id="security" className="py-20 px-6 bg-[#0F172A]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-[#3B82F6] uppercase mb-3">Trust & security</p>
          <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-white">Your documents stay secure</h2>
          <p style={{ fontSize: '16px' }} className="text-slate-400 mt-3">We built Guara for regulated industries. Security is not an afterthought.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {POINTS.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-colors">
              <Icon className="w-5 h-5 text-[#3B82F6] mb-3" />
              <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-white mb-1">{label}</p>
              <p style={{ fontSize: '13px' }} className="text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
