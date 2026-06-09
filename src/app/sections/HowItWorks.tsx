const STEPS = [
  { n: '01', title: 'Upload Documents', desc: 'Drop contracts, vendor lists, SOC reports, certificates, or DORA registers. Any combination works.' },
  { n: '02', title: 'AI Analyses Everything', desc: 'Guara reads every document, extracts vendor data, maps evidence, and identifies gaps in seconds.' },
  { n: '03', title: 'Review Your Programme', desc: 'Get a full vendor register, ICT register, gap analysis, concentration risk, and audit readiness score.' },
  { n: '04', title: 'Export & Audit', desc: 'Download regulator-ready PDF and Excel reports in one click.' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-[#2563EB] uppercase mb-3">Process</p>
          <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#0F172A]">How it works</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n}>
              <div className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center mb-4">
                <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-white">{n}</span>
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600 }} className="text-[#0F172A] mb-2">{title}</p>
              <p style={{ fontSize: '13px', lineHeight: 1.7 }} className="text-[#64748B]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
