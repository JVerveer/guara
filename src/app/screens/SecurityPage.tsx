import { Lock, Shield, Trash2, Award, Eye, CheckCircle2, Server, Globe } from 'lucide-react';

const POINTS = [
  { icon: Lock, title: 'Encrypted in transit', desc: 'All data is transferred over TLS 1.3. Nothing leaves your browser unencrypted.', tag: 'Transport' },
  { icon: Shield, title: 'Encrypted at rest', desc: 'Documents are stored with AES-256 encryption. Keys are managed per-tenant.', tag: 'Storage' },
  { icon: Trash2, title: 'Automatic deletion', desc: 'Set documents to auto-delete immediately after analysis, or on a custom schedule.', tag: 'Retention' },
  { icon: Award, title: 'SOC2-ready architecture', desc: 'Our infrastructure is built on SOC 2 Type II compliant cloud services.', tag: 'Compliance' },
  { icon: Eye, title: 'No model training', desc: 'Your documents are never used to train AI models. Your data is yours.', tag: 'Privacy' },
  { icon: CheckCircle2, title: 'Enterprise access control', desc: 'Role-based permissions and full audit logs on every action.', tag: 'Access' },
  { icon: Server, title: 'EU data residency', desc: 'Choose to keep all data within the EU. Supports GDPR and data sovereignty requirements.', tag: 'Residency' },
  { icon: Globe, title: 'Zero-trust architecture', desc: 'Every request is authenticated and authorised independently. No implicit trust.', tag: 'Architecture' },
];

export function SecurityPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-[#2563EB] uppercase mb-2">Trust & security</p>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#0F172A] mb-2">Your documents stay secure</h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6 }} className="text-[#64748B]">Guara is built for regulated industries. We treat your compliance documents with the same care your regulators expect.</p>
        </div>

        {/* Security score bar */}
        <div className="bg-[#0F172A] rounded-2xl p-5 mb-5 flex items-center justify-between">
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600 }} className="text-white mb-0.5">Security posture</p>
            <p style={{ fontSize: '12px' }} className="text-slate-400">Enterprise-grade across all layers</p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: '28px', fontWeight: 800 }} className="text-green-400">A+</p>
            <p style={{ fontSize: '11px' }} className="text-slate-500">Rating</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {POINTS.map(({ icon: Icon, title, desc, tag }) => (
            <div key={title} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">{title}</p>
                    <span style={{ fontSize: '10px', fontWeight: 600 }} className="bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded">{tag}</span>
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: 1.6 }} className="text-[#64748B]">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p style={{ fontSize: '13px', lineHeight: 1.6 }} className="text-green-800">
            <strong>For regulated financial institutions:</strong> Guara's data handling meets the requirements of DORA, GDPR, and major EU financial supervisory frameworks. Security documentation is available on request.
          </p>
        </div>
      </div>
    </div>
  );
}
