import {
  Archive,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  EvidenceItem,
  TEST_EVIDENCE_ITEMS,
  buildTestReportText,
} from '../lib/evidenceData';
import { buildZipArchive } from '../lib/zipBuilder';

export function EvidenceDriveView() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null);

  const handleDownloadAllZip = async () => {
    setErrorMessage(null);
    setIsZipping(true);
    try {
      const entries = await Promise.all(
        TEST_EVIDENCE_ITEMS.map(async (item) => {
          const res = await fetch(item.imageUrl);
          if (!res.ok) throw new Error(`โหลดภาพ ${item.fileName} ไม่สำเร็จ`);
          const buf = await res.arrayBuffer();
          return {
            name: `DigitalWork_Escrow_Test_Evidence/${item.fileName}`,
            data: new Uint8Array(buf),
          };
        })
      );

      entries.push({
        name: 'DigitalWork_Escrow_Test_Evidence/Test_Report_Summary.txt',
        data: new TextEncoder().encode(buildTestReportText()),
      });

      const zipBytes = buildZipArchive(entries);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'DigitalWork_Escrow_Test_Evidence.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'ไม่สามารถสร้างไฟล์ ZIP ได้');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Manual Download & GitHub Evidence Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              หลักฐานการทดสอบครบทั้ง 6 ฟังก์ชัน (7 ภาพ)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              ทดสอบด้วย Client <span className="font-mono text-slate-700">0x3291...d15C</span>, Freelancer{' '}
              <span className="font-mono text-slate-700">0xE052...0120</span> และ Admin{' '}
              <span className="font-mono text-slate-700">0x1444...D225</span> — เก็บไฟล์ไว้ในโฟลเดอร์{' '}
              <span className="font-mono text-slate-700">public/evidence/</span> แล้ว
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={`${import.meta.env.BASE_URL}evidence/Test_Report_Summary.txt`}
              download="Test_Report_Summary.txt"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>รายงานสรุป (.txt)</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadAllZip}
              disabled={isZipping}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {isZipping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>กำลังบีบอัด ZIP...</span>
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  <span>ดาวน์โหลดทั้งหมด (.zip)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {errorMessage}
          </div>
        )}
      </section>

      {/* Evidence Grid */}
      <section aria-label="รายการภาพหลักฐานแต่ละฟังก์ชัน" className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TEST_EVIDENCE_ITEMS.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
          >
            <div className="relative aspect-16/10 bg-slate-100 border-b border-slate-200 overflow-hidden">
              <img
                src={item.imageUrl}
                alt={`${item.titleTh} — หลักฐานการทดสอบ`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-top"
              />
              <div className="hidden absolute inset-0 items-center justify-center text-slate-400">
                <ImageIcon className="h-8 w-8" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-blue-700">
                    {item.stepNumber}. {item.functionName}
                  </span>
                  <span className="font-mono">{item.fileName}</span>
                </div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {item.titleTh}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.descriptionTh}</p>
                <p className="font-mono text-[11px] text-slate-500 pt-1">{item.actorTested}</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewItem(item)}
                  className="font-medium text-slate-700 hover:text-slate-900 underline"
                >
                  ขยายดูภาพ
                </button>
                <a
                  href={item.imageUrl}
                  download={item.fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ดาวน์โหลดรูป</span>
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Fullscreen Image Lightbox Preview */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          <div className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 id="preview-modal-title" className="font-display text-sm font-semibold text-slate-900">
                  {previewItem.stepNumber}. {previewItem.titleTh}
                </h3>
                <p className="font-mono text-xs text-slate-500">{previewItem.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="ปิดภาพขยาย"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="bg-slate-100 p-4 max-h-[80vh] overflow-auto">
              <img
                src={previewItem.imageUrl}
                alt={previewItem.titleTh}
                referrerPolicy="no-referrer"
                className="mx-auto w-full rounded-lg border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
