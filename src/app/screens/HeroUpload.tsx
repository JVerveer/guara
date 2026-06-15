import { useRef, useState, type InputHTMLAttributes } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  FileText,
  FolderOpen,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { FLOAT_DOCS } from '../data/constants';
import { SAMPLE_SCENARIOS } from '../../analysis/sampleAnalysis';
import { analyzeUploadedDocuments } from '../../analysis/analysisService';
import { theme } from '../../styles/theme';

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => {
    isDirectory?: boolean;
    isFile?: boolean;
  } | null;
};

const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'zip',
  'txt',
  'md',
  'json',
];

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isSupportedFile(file: File) {
  return SUPPORTED_EXTENSIONS.includes(getExtension(file.name));
}

function droppedContainsFolder(items: DataTransferItemList) {
  return Array.from(items).some((item) => {
    const entry = (item as DataTransferItemWithEntry).webkitGetAsEntry?.();

    return Boolean(entry?.isDirectory);
  });
}

export function HeroUpload() {
  const { startSample, startUploadedAnalysis } = useApp();

  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;

  const openFilePicker = () => fileInputRef.current?.click();
  const openFolderPicker = () => folderInputRef.current?.click();

  const addFiles = (incoming: File[]) => {
    setUploadError(null);

    if (incoming.length === 0) {
      return;
    }

    const unsupported = incoming.find((file) => !isSupportedFile(file));

    if (unsupported) {
      setUploadError(
        `"${unsupported.name}" is not supported. Please upload PDF, DOCX, XLSX, CSV, ZIP, TXT, MD, or JSON files.`
      );
      return;
    }

    setFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );

      const nextFiles = incoming.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;

        if (existingKeys.has(key)) {
          return false;
        }

        existingKeys.add(key);
        return true;
      });

      return [...prev, ...nextFiles].slice(0, 25);
    });
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== name));
  };

  const runRandomSample = () => {
    const randomScenario =
      SAMPLE_SCENARIOS[Math.floor(Math.random() * SAMPLE_SCENARIOS.length)];

    startSample(randomScenario.id);
  };

  const handleAnalyzeDocuments = async () => {
    if (!hasFiles || analyzing) {
      return;
    }

    try {
      setAnalyzing(true);
      setUploadError(null);

      const result = await analyzeUploadedDocuments(files);

      startUploadedAnalysis(result);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while preparing the analysis.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const floatingDocStyles = [
    {
      backgroundColor: theme.brand.primaryLight,
      borderColor: theme.brand.primaryBorder,
    },
    {
      backgroundColor: theme.status.infoLight,
      borderColor: theme.neutral.border,
    },
    {
      backgroundColor: theme.status.successLight,
      borderColor: theme.neutral.border,
    },
    {
      backgroundColor: theme.status.warningLight,
      borderColor: theme.neutral.border,
    },
    {
      backgroundColor: theme.status.errorLight,
      borderColor: theme.neutral.border,
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-6">
      <section className="w-full max-w-3xl">
        <div className="mb-5 flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
            style={{
              backgroundColor: theme.brand.primaryLight,
              borderColor: theme.brand.primaryBorder,
            }}
          >
            <div
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: theme.brand.primary }}
            />

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: theme.brand.primary,
              }}
            >
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
            color: theme.neutral.text,
          }}
          className="mb-3 text-center"
        >
          Analyze your vendor risk package
        </h1>

        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.6,
            color: theme.neutral.textSecondary,
          }}
          className="mx-auto mb-6 max-w-lg text-center"
        >
          Drop vendor documents below or start with a sample package.
        </p>

        <div className="relative isolate">
          <div className="pointer-events-none absolute -left-6 top-8 z-50 hidden flex-col gap-2 xl:flex">
            {FLOAT_DOCS.slice(0, 3).map((doc, index) => {
              const docStyle = floatingDocStyles[index % floatingDocStyles.length];

              return (
                <div
                  key={doc.label}
                  style={{
                    backgroundColor: docStyle.backgroundColor,
                    borderColor: docStyle.borderColor,
                    boxShadow: theme.shadow.card,
                    transform: `translateX(${
                      index === 1 ? '-10px' : index === 2 ? '8px' : '0px'
                    })`,
                  }}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 opacity-95 backdrop-blur-sm"
                >
                  <span style={{ fontSize: '13px' }}>{doc.icon}</span>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: theme.neutral.textSecondary,
                    }}
                    className="whitespace-nowrap"
                  >
                    {doc.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute -right-6 top-12 z-50 hidden flex-col gap-2 xl:flex">
            {FLOAT_DOCS.slice(3).map((doc, index) => {
              const docStyle =
                floatingDocStyles[(index + 3) % floatingDocStyles.length];

              return (
                <div
                  key={doc.label}
                  style={{
                    backgroundColor: docStyle.backgroundColor,
                    borderColor: docStyle.borderColor,
                    boxShadow: theme.shadow.card,
                    transform: `translateX(${index === 0 ? '8px' : '-8px'})`,
                  }}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 opacity-95 backdrop-blur-sm"
                >
                  <span style={{ fontSize: '13px' }}>{doc.icon}</span>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: theme.neutral.textSecondary,
                    }}
                    className="whitespace-nowrap"
                  >
                    {doc.label}
                  </span>
                </div>
              );
            })}
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
              setUploadError(null);

              if (droppedContainsFolder(event.dataTransfer.items)) {
                setUploadError(
                  'Folders cannot be dropped directly. Please zip the folder first and upload the ZIP file.'
                );
                return;
              }

              addFiles(Array.from(event.dataTransfer.files));
            }}
            className="relative z-10 flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-9 transition-all duration-200 sm:p-12"
            style={{
              backgroundColor: dragOver
                ? theme.brand.primaryLight
                : theme.neutral.surface,
              borderColor: uploadError
                ? theme.status.error
                : dragOver
                  ? theme.brand.primary
                  : theme.neutral.border,
              boxShadow: theme.shadow.card,
              transform: dragOver ? 'scale(1.01)' : 'scale(1)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.csv,.zip,.txt,.md,.json"
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(Array.from(event.target.files));
                }

                event.currentTarget.value = '';
              }}
            />

            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(Array.from(event.target.files));
                }

                event.currentTarget.value = '';
              }}
              {...({
                webkitdirectory: '',
                directory: '',
              } as DirectoryInputProps)}
            />

            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: theme.brand.primaryLight }}
            >
              <Upload className="h-7 w-7" style={{ color: theme.brand.primary }} />
            </div>

            <p
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
              className="mb-2 text-center"
            >
              Drop files here
            </p>

            <p
              style={{ fontSize: '14px', color: theme.neutral.textMuted }}
              className="mb-5 text-center"
            >
              PDF · DOCX · XLSX · CSV · ZIP · Folder picker
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
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: theme.neutral.background,
                    color: theme.neutral.textSecondary,
                  }}
                  className="rounded-full px-3 py-1"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {uploadError && (
            <div
              className="relative z-20 mt-3 flex items-start gap-2 rounded-xl border px-4 py-3"
              style={{
                backgroundColor: theme.status.errorLight,
                borderColor: theme.status.error,
                color: theme.status.error,
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />

              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {uploadError}
              </p>
            </div>
          )}

          {files.length > 0 && (
            <div className="relative z-20 mt-3 space-y-1.5">
              {files.map((file) => (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between rounded-xl border px-4 py-2.5"
                  style={{
                    backgroundColor: theme.neutral.surface,
                    borderColor: theme.neutral.border,
                    boxShadow: theme.shadow.card,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText
                      className="h-4 w-4 shrink-0"
                      style={{ color: theme.brand.primary }}
                    />

                    <div className="min-w-0">
                      <span
                        style={{
                          fontSize: '13px',
                          color: theme.neutral.textSecondary,
                        }}
                        className="block truncate"
                      >
                        {file.webkitRelativePath || file.name}
                      </span>

                      <span
                        style={{
                          fontSize: '10.5px',
                          color: theme.neutral.textMuted,
                        }}
                      >
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeFile(file.name);
                    }}
                    className="transition-colors"
                    style={{ color: theme.neutral.textMuted }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.color = theme.status.error;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.color = theme.neutral.textMuted;
                    }}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={`relative z-20 mt-4 grid gap-3 ${
              hasFiles ? 'grid-cols-1' : 'sm:grid-cols-3'
            }`}
          >
            {!hasFiles && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  runRandomSample();
                }}
                disabled={analyzing}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  backgroundColor: theme.brand.primary,
                  boxShadow: theme.shadow.brand,
                  color: theme.neutral.surface,
                }}
                onMouseEnter={(event) => {
                  if (!analyzing) {
                    event.currentTarget.style.backgroundColor =
                      theme.brand.primaryHover;
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = theme.brand.primary;
                }}
              >
                <BarChart3 className="h-4 w-4" />
                Try Sample Package
              </button>
            )}

            {!hasFiles && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openFilePicker();
                }}
                disabled={analyzing}
                className="flex items-center justify-center gap-2 rounded-xl border px-5 py-3 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: theme.neutral.surface,
                  borderColor: theme.neutral.border,
                  color: theme.neutral.textSecondary,
                }}
                onMouseEnter={(event) => {
                  if (!analyzing) {
                    event.currentTarget.style.backgroundColor =
                      theme.neutral.background;
                    event.currentTarget.style.borderColor =
                      theme.neutral.borderStrong;
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor =
                    theme.neutral.surface;
                  event.currentTarget.style.borderColor = theme.neutral.border;
                }}
              >
                <Upload className="h-4 w-4" style={{ color: theme.brand.primary }} />
                Upload Files
              </button>
            )}

            {!hasFiles && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openFolderPicker();
                }}
                disabled={analyzing}
                className="flex items-center justify-center gap-2 rounded-xl border px-5 py-3 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: theme.neutral.surface,
                  borderColor: theme.neutral.border,
                  color: theme.neutral.textSecondary,
                }}
                onMouseEnter={(event) => {
                  if (!analyzing) {
                    event.currentTarget.style.backgroundColor =
                      theme.neutral.background;
                    event.currentTarget.style.borderColor =
                      theme.neutral.borderStrong;
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor =
                    theme.neutral.surface;
                  event.currentTarget.style.borderColor = theme.neutral.border;
                }}
              >
                <FolderOpen
                  className="h-4 w-4"
                  style={{ color: theme.brand.primary }}
                />
                Upload Folder
              </button>
            )}

            {hasFiles && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleAnalyzeDocuments();
                }}
                disabled={analyzing}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  backgroundColor: theme.brand.primary,
                  boxShadow: theme.shadow.brand,
                  color: theme.neutral.surface,
                }}
                onMouseEnter={(event) => {
                  if (!analyzing) {
                    event.currentTarget.style.backgroundColor =
                      theme.brand.primaryHover;
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = theme.brand.primary;
                }}
              >
                <ArrowRight className="h-4 w-4" />
                {analyzing
                  ? 'Preparing Analysis…'
                  : `Analyze ${files.length} Document${files.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          <p
            style={{ fontSize: '12px', color: theme.neutral.textMuted }}
            className="relative z-20 mt-3 text-center"
          >
            {hasFiles
              ? 'Uploaded documents are analysed locally in this demo flow.'
              : 'No signup required to try the sample package.'}
          </p>
        </div>
      </section>
    </div>
  );
}
