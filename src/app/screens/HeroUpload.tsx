import { useState, useRef } from 'react';
import { Upload, FileText, BarChart3, X, ArrowRight } from 'lucide-react';
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

  const openFilePicker = () => inputRef.current?.click();

  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-3xl">
        <div className="flex justify-center mb-5">
          <div className="inline-flex items-center gap-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
            <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#2563EB]">
              DORA vendor risk · AI-powered
            </span>
          </div>
        </div>

        <h1
          style={{
            fontSize: 'clamp(24px, 4vw, 42px)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
          }}
          className="text-[#0F172A] text-center mb-3"
        >
          See how messy vendor documents become an
          <br className="hidden sm:block" />
          <span className="text-[#2563EB]"> audit-ready DORA program.</span>
        </h1>

        <p
          style={{ fontSize: '15px', lineHeight: 1.6 }}
          className="text-[#64748B] text-center mb-7 max-w-xl mx-auto"
        >
          Start with a sample package or upload contracts, SOC reports, certificates, and vendor lists.
          Guara identifies gaps, risks, and audit readiness automatically.
        </p>

        <div className="relative">
          <div className="absolute -left-8 top-8 hidden xl:flex flex-col gap-2 pointer-events-none">
            {FLOAT_DOCS.slice(0, 3).map((doc) => (
              <div
                key={doc.label}
                style={{ background: doc.color, borderColor: doc.border }}
                className="border rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm opacity-75"
              >
                <span style={{ fontSize: '13px' }}>{doc.icon}</span>
                <span
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  className="text-[#334155] whitespace-nowrap"
                >
                  {doc.label}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute -right-8 top-10 hidden xl:flex flex-col gap-2 pointer-events-none">
            {FLOAT_DOCS.slice(3).map((doc) => (
              <div
                key={doc.label}
                style={{ background: doc.color, borderColor: doc.border }}
                className="border rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm opacity-75"
              >
                <span style={{ fontSize: '13px' }}>{doc.icon}</span>
                <span
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  className="text-[#334155] whitespace-nowrap"
                >
                  {doc.label}
                </span>
              </div>
            ))}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={openFilePicker}
            className={`bg-white border-2 border-dashed rounded-3xl p-9 sm:p-12 min-h-[300px] cursor-pointer transition-all duration-200 shadow-sm flex flex-col items-center justify-center ${
              dragOver
                ? 'border-[#2563EB] bg-[#EFF6FF] scale-[1.01]'
                : 'border-[#E2E8F0] hover:border-[#93C5FD]'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.zip"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
            />

            <div className="w-14 h-14 bg-[#EFF6FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-[#2563EB]" />
            </div>

            <p style={{ fontSize: '20px', fontWeight: 700 }} className="text-[#0F172A] text-center mb-2">
              Drop compliance documents here
            </p>

            <p style={{ fontSize: '14px' }} className="text-[#94A3B8] text-center mb-5">
              PDF · DOCX · XLSX · CSV · ZIP
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-xl">
              {['Contracts', 'Vendor Lists', 'Questionnaires', 'SOC Reports', 'ISO Certificates', 'DORA Registers'].map(
                (t) => (
                  <span
                    key={t}
                    style={{ fontSize: '12px', fontWeight: 500 }}
                    className="bg-[#F1F5F9] text-[#64748B] px-3 py-1 rounded-full"
                  >
                    {t}
                  </span>
                ),
              )}
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {files.map((f) => (
                <div
                  key={f}
                  className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                    <span style={{ fontSize: '13px' }} className="text-[#334155] truncate">
                      {f}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(f);
                    }}
                    className="text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                    aria-label={`Remove ${f}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={startSample}
              className="flex-1 bg-[#2563EB] text-white px-5 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-md shadow-blue-200 flex items-center justify-center gap-2"
              style={{ fontSize: '14px', fontWeight: 600 }}
            >
              <BarChart3 className="w-4 h-4" />
              Try Sample DORA Package
            </button>

            <button
              type="button"
              onClick={hasFiles ? undefined : openFilePicker}
              className="flex-1 bg-white border border-[#E2E8F0] text-[#334155] px-5 py-3 rounded-xl hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all flex items-center justify-center gap-2"
              style={{ fontSize: '14px', fontWeight: 500 }}
            >
              {hasFiles ? (
                <>
                  <ArrowRight className="w-4 h-4 text-[#2563EB]" />
                  Analyze Documents
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-[#2563EB]" />
                  Upload Your Documents
                </>
              )}
            </button>
          </div>

          <p style={{ fontSize: '12px' }} className="text-[#94A3B8] text-center mt-3">
            Not ready to upload sensitive files? Start with the sample DORA package first.
          </p>

          <div className="mt-6 bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm">
            <p
              style={{ fontSize: '13px', fontWeight: 600 }}
              className="text-[#0F172A] text-center mb-3"
            >
              Try the sample package to see what Guara generates
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['Vendor inventory', 'Missing evidence report', 'DORA gap analysis'].map((label) => (
                <div
                  key={label}
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-center"
                >
                  <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#64748B]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}