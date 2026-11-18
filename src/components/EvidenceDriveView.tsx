import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  LogOut,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DriveUploadedFile,
  EvidenceItem,
  TEST_EVIDENCE_ITEMS,
  buildTestReportText,
  createDriveFolder,
  getDriveAccessToken,
  initGoogleDriveAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  uploadBlobToDriveFolder,
} from '../lib/googleDriveService';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'done' | 'error';
  file?: DriveUploadedFile;
  error?: string;
}

export function EvidenceDriveView() {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [folderName, setFolderName] = useState('DigitalWork_Escrow_Test_Evidence');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [createdFolder, setCreatedFolder] = useState<DriveUploadedFile | null>(null);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, UploadStatus>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    const unsub = initGoogleDriveAuth(
      (user) => {
        setGoogleUser(user);
        setNeedsAuth(false);
      },
      () => {
        setGoogleUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const result = await signInWithGoogleDrive();
      setGoogleUser(result.user);
      setNeedsAuth(false);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogleDrive();
    setGoogleUser(null);
    setNeedsAuth(true);
    setCreatedFolder(null);
    setUploadStatuses({});
  };

  const handleConfirmUploadToDrive = async () => {
    setIsConfirmModalOpen(false);
    setUploadError(null);
    setCreatedFolder(null);

    const token = await getDriveAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setUploadError('เซสชันการเชื่อมต่อ Google Drive หมดอายุ กรุณา Sign in with Google ใหม่อีกครั้ง');
      return;
    }

    setIsUploadingAll(true);
    try {
      const folder = await createDriveFolder(token, folderName);
      setCreatedFolder(folder);

      for (const item of TEST_EVIDENCE_ITEMS) {
        setUploadStatuses((prev) => ({ ...prev, [item.id]: { status: 'uploading' } }));
        try {
          const imgRes = await fetch(item.imageUrl);
          if (!imgRes.ok) {
            throw new Error(`ไม่สามารถโหลดภาพ ${item.fileName} (${imgRes.status})`);
          }
          const blob = await imgRes.blob();
          const uploaded = await uploadBlobToDriveFolder(
            token,
            folder.id,
            item.fileName,
            blob,
            'image/png'
          );
          setUploadStatuses((prev) => ({
            ...prev,
            [item.id]: { status: 'done', file: uploaded },
          }));
        } catch (fileErr) {
          setUploadStatuses((prev) => ({
            ...prev,
            [item.id]: {
              status: 'error',
              error: fileErr instanceof Error ? fileErr.message : 'อัปโหลดล้มเหลว',
            },
          }));
        }
      }

      // Upload summary report text file
      setUploadStatuses((prev) => ({ ...prev, report: { status: 'uploading' } }));
      try {
        const reportBlob = new Blob([buildTestReportText()], { type: 'text/plain;charset=utf-8' });
        const reportFile = await uploadBlobToDriveFolder(
          token,
          folder.id,
          'Test_Report_Summary.txt',
          reportBlob,
          'text/plain'
        );
        setUploadStatuses((prev) => ({
          ...prev,
          report: { status: 'done', file: reportFile },
        }));
      } catch (repErr) {
        setUploadStatuses((prev) => ({
          ...prev,
          report: {
            status: 'error',
            error: repErr instanceof Error ? repErr.message : 'อัปโหลดรายงานล้มเหลว',
          },
        }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลดขึ้น Google Drive');
    } finally {
      setIsUploadingAll(false);
    }
  };

  const completedCount = Object.values(uploadStatuses).filter((s) => s.status === 'done').length;

  return (
    <div className="space-y-6">
      {/* Google Drive Upload Control Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              รวมภาพหลักฐานการทดสอบทุกฟังก์ชัน (7 ภาพ) และอัปโหลดขึ้น Google Drive
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              ทดสอบครบทั้ง 6 ฟังก์ชันด้วย Client <span className="font-mono">0x3291...d15C</span>, Freelancer{' '}
              <span className="font-mono">0xE052...0120</span> และ Admin <span className="font-mono">0x1444...D225</span>
            </p>
          </div>

          {needsAuth ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-xs hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs text-slate-600">
                บัญชี Google: <span className="font-medium text-slate-900">{googleUser?.email || googleUser?.displayName}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>

        {authError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {authError}
          </div>
        )}

        {!needsAuth && (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 max-w-md">
              <label htmlFor="drive-folder-name" className="block text-xs font-medium text-slate-700">
                ชื่อโฟลเดอร์ปลายทางใน Google Drive
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                <input
                  id="drive-folder-name"
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isUploadingAll}
              onClick={() => setIsConfirmModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {isUploadingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>กำลังอัปโหลด ({completedCount}/8)...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  <span>อัปโหลดหลักฐานทั้งหมด (8 ไฟล์) ขึ้น Google Drive</span>
                </>
              )}
            </button>
          </div>
        )}

        {uploadError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {uploadError}
          </div>
        )}

        {createdFolder && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                สร้างโฟลเดอร์ <span className="font-mono">{createdFolder.name}</span> บน Google Drive แล้ว (อัปโหลดสำเร็จ {completedCount}/8 ไฟล์)
              </span>
            </div>
            <a
              href={createdFolder.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-emerald-800 underline hover:text-emerald-950"
            >
              <span>เปิดโฟลเดอร์ใน Google Drive</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}
      </section>

      {/* Evidence Grid */}
      <section aria-label="รายการภาพหลักฐานแต่ละฟังก์ชัน" className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TEST_EVIDENCE_ITEMS.map((item) => {
          const st = uploadStatuses[item.id];
          return (
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

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-3">
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
                      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>ดาวน์โหลด</span>
                    </a>
                  </div>

                  {st?.status === 'uploading' && (
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>กำลังอัปโหลด...</span>
                    </span>
                  )}
                  {st?.status === 'done' && st.file && (
                    <a
                      href={st.file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>ดูบน Drive</span>
                    </a>
                  )}
                  {st?.status === 'error' && (
                    <span className="text-red-600">{st.error || 'อัปโหลดล้มเหลว'}</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Explicit User Confirmation Modal before writing to Google Drive */}
      {isConfirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-confirm-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="drive-confirm-title" className="font-display text-base font-semibold text-slate-900">
                  ยืนยันการสร้างโฟลเดอร์และอัปโหลดขึ้น Google Drive
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  ระบบจะสร้างโฟลเดอร์ใหม่ชื่อ <span className="font-mono font-semibold text-slate-800">{folderName}</span> และอัปโหลดไฟล์ทั้งหมด 8 ไฟล์ไปยัง Google Drive ของคุณ ({googleUser?.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                aria-label="ปิดหน้าต่างยืนยัน"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700 space-y-1">
              {TEST_EVIDENCE_ITEMS.map((i) => (
                <div key={i.id}>• {i.fileName}</div>
              ))}
              <div>• Test_Report_Summary.txt</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmUploadToDrive}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                ยืนยันอัปโหลด (8 ไฟล์)
              </button>
            </div>
          </div>
        </div>
      )}

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
