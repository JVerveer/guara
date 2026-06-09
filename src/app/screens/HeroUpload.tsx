import { useState, useRef } from 'react';
import { Upload, FileText, BarChart3, X, Zap } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { FLOAT_DOCS } from '../data/constants';

export function HeroUpload() {
  const { startSample } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming.map((f) => f.name)].slice(0, 5));
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f !== name));

  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        {/* Pill */}
        <div className="inline-flex items-center gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-3 py-1 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
          <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#2563EB]">DORA-compliant vendor risk · AI-powered</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: '48px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' }} className="text-[#0F172A] mb-4">
          Turn compliance documents<br />into an audit-ready<br />
          <span className="text-[#2563EB]">vendor risk program.</span>
        </h1>
        <p style={{ fontSize: '18px', lineHeight: 1.6 }} className="text-[#64748B] mb-10 max-w-2xl mx-auto">
          Upload contracts, vendor lists, questionnaires, SOC reports, and certificates.
          Guara automatically identifies vendors, missing evidence, DORA gaps, concentration risks, and audit readiness.
        </p>

        {/* Upload area with floating doc cards */}
        <div className="relative">
          <div className="absolute -left-4 top-8 hidden lg:flex flex-col gap-2 pointer-events-none">
            {FLOAT_DOCS.slice(0, 3).map((doc) => (
              <div key={doc.label} style={{ background: doc.color, borderColor: doc.border }} className="border rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm opacity-80">
                <span style={{ fontSize: '14px' }}>{doc.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: 500 }} className="text-[#334155] whitespace-nowrap">{doc.label}</span>
              </div>
            ))}
          </div>
          <div className="absolute -right-4 top-12 hidden lg:flex flex-col gap-2 pointer-events-none">
            {FLOAT_DOCS.slice(3).map((doc) => (
              <div key={doc.label} style={{ background: doc.color, borderColor: doc.border }} className="border rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm opacity-80">
                <span style={{ fontSize: '14px' }}>{doc.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: 500 }} className="text-[#334155] whitespace-nowrap">{doc.label}</span>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => inputRef.current?.click()}
            className={`bg-white border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-200 shadow-sm ${dragOver ? 'border-[#2563EB] bg-[#EFF6FF] scale-[1.01]' : 'border-[#E2E8F0] hover:border-[#93C5FD] hover:bg-[#F8FAFC]'}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.zip"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
            />
            <div className="w-12 h-12 bg-[#EFF6FF] rounded-xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-[#2563EB]" />
            </div>
            <p style={{ fontSize: '17px', fontWeight: 600 }} className="text-[#0F172A] mb-1">Drop compliance documents here</p>
            <p style={{ fontSize: '13px' }} className="text-[#94A3B8] mb-4">Supported: PDF · DOCX · XLSX · CSV · ZIP</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Contracts', 'Vendor Lists', 'Questionnaires', 'SOC Reports', 'ISO Certificates', 'DORA Registers'].map((t) => (
                <span key={t} style={{ fontSize: '11px', fontWeight: 500 }} className="bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>

          {/* Staged files */}
          {files.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
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
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              className="flex-1 sm:flex-none bg-[#2563EB] text-white px-7 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2"
              style={{ fontSize: '15px', fontWeight: 600 }}
            >
              <Upload className="w-4 h-4" />
              Upload Documents
            </button>
            <button
              onClick={startSample}
              className="flex-1 sm:flex-none bg-white border border-[#E2E8F0] text-[#334155] px-7 py-3 rounded-xl hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all flex items-center justify-center gap-2"
              style={{ fontSize: '15px', fontWeight: 500 }}
            >
              <BarChart3 className="w-4 h-4 text-[#2563EB]" />
              Try Sample DORA Package
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
