import { useRef, useState } from 'react';
import { ArrowRight, BarChart3, FileText, Upload, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { FLOAT_DOCS } from '../data/constants';

export function HeroUpload() {
  const { startSample } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;

  const openFilePicker = () => inputRef.current?.click();

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming.map((file) => file.name)].slice(0, 5));
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((file) => file !== name));
  };

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-6">
      <section className="w-full max-w-3xl">
        <div className="mb-5 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2563EB]" />
            <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#2563EB]">
              AI-powered vendor risk analysis
            </span>
          </div>
        </div>

        <h1
          style={{
            fontSize: 'clamp(24px, 4vw, 40px)',
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.03em',
          }}
          className="mb-3 text-center text-[#0F172A]"
        >
          Analyze your vendor risk package
        </h1>

        <p
          style={{ fontSize: '15px', lineHeight: 1.6 }}
          className="mx-auto mb-6 max-w-lg text-center text-[#64748B]"
        >
          Drop vendor documents below or start with a sample package.
        </p>

        <div className="relative">
          <div className="pointer-events-none absolute -left-8 top-8 hidden flex-col gap-2 xl:flex">
            {FLOAT_DOCS.slice(0, 3).map((doc) => (
              <div
                key={doc.label}
                style={{ background: doc.color, borderColor: doc.border }}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 opacity-75 shadow-sm"
              >
                <span style={{ fontSize: '13px' }}>{doc.icon}</span>
                <span
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  className="whitespace-nowrap text-[#334155]"
                >
                  {doc.label}
                </span>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute -right-8 top-10 hidden flex-col gap-2 xl:flex">
            {FLOAT_DOCS.slice(3).map((doc) => (
              <div
                key={doc.label}
                style={{ background: doc.color, borderColor: doc.border }}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 opacity-75 shadow-sm"
              >
                <span style={{ fontSize: '13px' }}>{doc.icon}</span>
                <span
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  className="whitespace-nowrap text-[#334155]"
                >
                  {doc.label}
                </span>
              </div>
            ))}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                openFilePicker();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-white p-9 shadow-sm transition-all duration-200 sm:p-12 ${
              dragOver
                ? 'scale-[1.01] border-[#2563EB] bg-[#EFF6FF]'
                : 'border-[#E2E8F0] hover:border-[#93C5FD]'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.zip"
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(Array.from(event.target.files));
                }
              }}
            />

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF]">
              <Upload className="h-7 w-7 text-[#2563EB]" />
            </div>

            <p
              style={{ fontSize: '20px', fontWeight: 700 }}
              className="mb-2 text-center text-[#0F172A]"
            >
              Drop files here
            </p>

            <p style={{ fontSize: '14px' }} className="mb-5 text-center text-[#94A3B8]">
              PDF · DOCX · XLSX · CSV · ZIP
            </p>

            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {[
                'Contracts',
                'Vendor Lists',
                'Questionnaires',
                'SOC Reports',
                'ISO Certificates',
                'DORA Registers',
                'AI Policies',
                'DPAs',
              ].map((label) => (
                <span
                  key={label}
                  style={{ fontSize: '12px', fontWeight: 500 }}
                  className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[#64748B]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {files.map((file) => (
                <div
                  key={file}
                  className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[#2563EB]" />
                    <span style={{ fontSize: '13px' }} className="truncate text-[#334155]">
                      {file}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeFile(file);
                    }}
                    className="text-[#94A3B8] transition-colors hover:text-[#EF4444]"
                    aria-label={`Remove ${file}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={startSample}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-white shadow-md shadow-blue-200 transition-colors hover:bg-[#1D4ED8]"
              style={{ fontSize: '14px', fontWeight: 600 }}
            >
              <BarChart3 className="h-4 w-4" />
              Try Sample Package
            </button>

            <button
              type="button"
              onClick={hasFiles ? undefined : openFilePicker}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-5 py-3 text-[#334155] transition-all hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              style={{ fontSize: '14px', fontWeight: 500 }}
            >
              {hasFiles ? (
                <>
                  <ArrowRight className="h-4 w-4 text-[#2563EB]" />
                  Analyze Documents
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-[#2563EB]" />
                  Upload Your Documents
                </>
              )}
            </button>
          </div>

          <p style={{ fontSize: '12px' }} className="mt-3 text-center text-[#94A3B8]">
            No signup required to try the sample package.
          </p>
        </div>
      </section>
    </div>
  );
}