import { CheckCircle2, Zap } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PROCESSING_STEPS, SAMPLE_DOCS } from '../data/constants';

export function ProcessingScreen() {
  const { stepsDone } = useApp();

  const totalMs = PROCESSING_STEPS.reduce((a, s) => a + s.duration, 0);
  const doneSoFar = PROCESSING_STEPS.slice(0, stepsDone).reduce((a, s) => a + s.duration, 0);
  const progress = Math.round((doneSoFar / totalMs) * 100);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-start sm:justify-center min-h-full px-4 py-6">
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-3 py-1 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
              <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#2563EB]">Sample DORA Package · 8 documents · 43 vendors</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-[#0F172A] mb-1">Analysing your package</h2>
            <p style={{ fontSize: '13px' }} className="text-[#64748B]">Guara AI is reading all documents and building your vendor risk programme.</p>
          </div>

          {/* Two columns on md+ */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* Document list */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#0F172A]">Documents loaded</span>
                <span style={{ fontSize: '11px' }} className="text-[#94A3B8]">8 files</span>
              </div>
              <div className="divide-y divide-[#F8FAFC]">
                {SAMPLE_DOCS.map((doc, i) => (
                  <div key={doc.name} className={`flex items-center gap-2 px-4 py-2.5 transition-all duration-300 ${i <= stepsDone ? 'opacity-100' : 'opacity-30'}`}>
                    <span style={{ fontSize: '14px' }}>{doc.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: '11px', fontWeight: 500 }} className="text-[#0F172A] truncate">{doc.name}</p>
                      <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">{doc.type}</p>
                    </div>
                    {i < stepsDone
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      : i === stepsDone
                      ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin flex-shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-[#E2E8F0] flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* AI steps */}
            <div className="bg-[#0F172A] rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-[#2563EB] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-white">AI Analysis Engine</span>
                <div className="ml-auto flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {PROCESSING_STEPS.map((s, i) => {
                  const done = i < stepsDone;
                  const active = i === stepsDone;
                  return (
                    <div key={s.label} className={`flex items-center gap-2.5 transition-all duration-300 ${done || active ? 'opacity-100' : 'opacity-20'}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-green-500' : active ? 'border-2 border-[#3B82F6]' : 'border border-slate-600'}`}>
                        {done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        {active && <div className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full animate-pulse" />}
                      </div>
                      <span style={{ fontSize: '12px' }} className={done ? 'text-slate-500 line-through' : active ? 'text-white' : 'text-slate-600'}>{s.label}</span>
                      {done && <span style={{ fontSize: '10px' }} className="ml-auto text-green-400">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="flex justify-between mb-2">
              <span style={{ fontSize: '12px' }} className="text-[#64748B]">Analysis progress</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">{progress}%</span>
            </div>
            <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div className="h-full bg-[#2563EB] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
