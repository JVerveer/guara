import { useState, useRef } from 'react';
import { Upload, FileText, BarChart3, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { FLOAT_DOCS } from '../data/constants';

export function HeroUpload() {
  const { startSample } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) =>
    setFiles((prev) => [...prev, ...incoming.map((f) => f.name)].slice(0, 5));

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f !== name));

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Pill */}
        <div className="flex justify-center mb-5">
          <div className="inline-flex items-center gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
            <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#2563EB]">DORA-compliant vendor risk · AI-powered</span>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.025em' }} className="text-[#0F172A] text-center mb-3">
          Turn compliance documents into an<br className="hidden sm:block" />
          <span className="text-[#2563EB]"> audit-ready vendor risk program.</span>
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.6 }} className="text-[#64748B] text-center mb-6 max-w-lg mx-auto">
          Upload contracts, SOC reports, certificates, and vendor lists. Guara identifies gaps, risks, and audit readiness automatically.
        </p>

        {/* Upload zone */}
        <div className="relative">
          {/* Floating doc pills — desktop only */}
          <div className="absolute -left-2 top-4 hidden xl:flex flex-col gap-1.5 pointer-events-none">
            {FLOAT_DOCS.slice(0, 3).map((doc) => (
              <div key={doc.label} style={{ background: doc.color, borderColor: doc.border }} className="border rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm opacity-75">
                <span style={{ fontSize: '12px' }}>{doc.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: 500 }} className="text-[#334155] whitespace-nowrap">{doc.label}</span>
              </div>
            ))}
          </div>
          <div className="absolute -right-2 top-6 hidden xl:flex flex-col gap-1.5 pointer-events-none">
            {FLOAT_DOCS.slice(3).map((doc) => (
              <div key={doc.label} style={{ background: doc.color, borderColor: doc.border }} className="border rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm opacity-75">
                <span style={{ fontSize: '12px' }}>{doc.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: 500 }} className="text-[#334155] whitespace-nowrap">{doc.label}</span>
              </div>
            ))}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => inputRef.current?.click()}
            className={`bg-white border-2 border-dashed rounded-2xl p-6 sm:p-8 cursor-pointer transition-all duration-200 shadow-sm ${dragOver ? 'border-[#2563EB] bg-[#EFF6FF] scale-[1.01]' : 'border-[#E2E8F0] hover:border-[#93C5FD]'}`}
          >
            <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.zip" className="hidden"
              onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))} />
            <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center mx-auto mb-3">
              <Upload className="w-5 h-5 text-[#2563EB]" />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 600 }} className="text-[#0F172A] text-center mb-1">Drop compliance documents here</p>
            <p style={{ fontSize: '13px' }} className="text-[#94A3B8] text-center mb-3">PDF · DOCX · XLSX · CSV · ZIP</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['Contracts', 'Vendor Lists', 'Questionnaires', 'SOC Reports', 'ISO Certificates', 'DORA Registers'].map((t) => (
                <span key={t} style={{ fontSize: '11px', fontWeight: 500 }} className="bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>

          {/* Staged files */}
          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((f) => (
                <div key={f} className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2563EB]" />
                    <span style={{ fontSize: '13px' }} className="text-[#334155]">{f}</span>
                  </div>
                  <button onClick={() => removeFile(f)} className="text-[#94A3B8] hover:text-[#EF4444] transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button className="flex-1 bg-[#2563EB] text-white px-5 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2" style={{ fontSize: '14px', fontWeight: 600 }}>
              <Upload className="w-4 h-4" />
              Upload Documents
            </button>
            <button onClick={startSample} className="flex-1 bg-white border border-[#E2E8F0] text-[#334155] px-5 py-3 rounded-xl hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all flex items-center justify-center gap-2" style={{ fontSize: '14px', fontWeight: 500 }}>
              <BarChart3 className="w-4 h-4 text-[#2563EB]" />
              Try Sample DORA Package
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
