import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  EVENT_LABEL_MAP,
  JOB_STATE_META,
  formatEthFromWei,
  formatThaiDateTime,
  getEtherscanAddressUrl,
  getEtherscanTxUrl,
  shortenAddress,
} from '../lib/contract';
import { getUserRoleForJob } from '../lib/escrowEngine';
import { ExecutionMode, JobItem, JobState, TransactionRecord } from '../lib/types';

interface JobDetailModalProps {
  job: JobItem | null;
  transactions: TransactionRecord[];
  mode: ExecutionMode;
  currentUserAddress: string | null;
  adminAddress: string;
  onClose: () => void;
  onDepositPayment: (job: JobItem) => Promise<void>;
  onSubmitWork: (job: JobItem, workProof: string) => Promise<void>;
  onApproveAndRelease: (job: JobItem) => Promise<void>;
  onRaiseDispute: (job: JobItem) => Promise<void>;
  onResolveDispute: (job: JobItem, releaseToFreelancer: boolean) => Promise<void>;
}

const LIFECYCLE_STEPS = [
  { state: JobState.Created, title: 'สร้างข้อตกลง' },
  { state: JobState.Funded, title: 'ฝากเงิน Escrow' },
  { state: JobState.Submitted, title: 'ส่งมอบงาน' },
  { state: JobState.Completed, title: 'อนุมัติจ่ายเงิน' },
];

export function JobDetailModal({
  job,
  transactions,
  mode,
  currentUserAddress,
  adminAddress,
  onClose,
  onDepositPayment,
  onSubmitWork,
  onApproveAndRelease,
  onRaiseDispute,
  onResolveDispute,
}: JobDetailModalProps) {
  const [workProofInput, setWorkProofInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setActionError(null);
    setWorkProofInput('');
    if (!job) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyAction) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [job, busyAction, onClose]);

  if (!job) return null;

  const stateMeta = JOB_STATE_META[job.state];
  const role = getUserRoleForJob(currentUserAddress, job, adminAddress);
  const jobTransactions = transactions.filter((t) => t.jobId === job.id);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setActionError(null);
    setBusyAction(label);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'การทำรายการล้มเหลว');
    } finally {
      setBusyAction(null);
    }
  };

  const isUrlProof =
    job.workProof.startsWith('http://') || job.workProof.startsWith('https://');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-detail-title"
    >
      <div className="my-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">สัญญา #{job.id}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-medium ${stateMeta.textClass}`}>{stateMeta.labelTh}</span>
              {role !== 'viewer' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-blue-700">
                    สิทธิ์ของคุณ:{' '}
                    {role === 'client'
                      ? 'ผู้ว่าจ้าง (Client)'
                      : role === 'freelancer'
                      ? 'ฟรีแลนซ์ (Freelancer)'
                      : 'ผู้ดูแลระบบ (Admin)'}
                  </span>
                </>
              )}
            </div>
            <h2 id="job-detail-title" className="mt-1 font-display text-lg font-semibold text-slate-900">
              {job.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busyAction)}
            aria-label="ปิดรายละเอียดสัญญา"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Lifecycle Stepper */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LIFECYCLE_STEPS.map((step, index) => {
                const isDisputeOrRefund =
                  job.state === JobState.Disputed || job.state === JobState.Refunded;
                const reached =
                  !isDisputeOrRefund && job.state >= step.state;
                const isCurrent = !isDisputeOrRefund && job.state === step.state;

                return (
                  <div key={step.state} className="flex items-center gap-2.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                        reached
                          ? isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        reached ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
            {(job.state === JobState.Disputed || job.state === JobState.Refunded) && (
              <div className="mt-3 border-t border-slate-200 pt-2.5 text-xs font-medium text-red-700">
                {job.state === JobState.Disputed
                  ? 'สถานะพิเศษ: เกิดข้อพิพาท — การโอนเงินถูกระงับไว้ใน Escrow รอ Admin ตัดสิน'
                  : 'สถานะพิเศษ: Admin ตัดสินคืนเงินค่าจ้างกลับให้ผู้ว่าจ้างแล้ว'}
              </div>
            )}
          </div>

          {/* Contract Terms Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">ค่าจ้างตามข้อตกลง</span>
                <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {formatEthFromWei(job.amountWei)} ETH
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">จำนวนหน่วย Wei</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {job.amountWei}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">กำหนดส่งมอบงาน</span>
                <span className="text-xs font-medium text-slate-800 tabular-nums">
                  {formatThaiDateTime(job.deadline)}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">ผู้ว่าจ้าง (Client)</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-800">{shortenAddress(job.client)}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('client', job.client)}
                    aria-label="คัดลอก Address ผู้ว่าจ้าง"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {copiedKey === 'client' ? (
                      <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">ฟรีแลนซ์ (Freelancer)</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-800">{shortenAddress(job.freelancer)}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('freelancer', job.freelancer)}
                    aria-label="คัดลอก Address ฟรีแลนซ์"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {copiedKey === 'freelancer' ? (
                      <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">ผู้ดูแลระบบ (Admin)</span>
                <a
                  href={getEtherscanAddressUrl(adminAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
                >
                  <span>{shortenAddress(adminAddress)}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Description & Work Proof */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700">รายละเอียดขอบเขตงาน</h3>
              <p className="mt-1.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            {job.workProof && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    หลักฐานการส่งมอบงาน (Work Proof)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('proof', job.workProof)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                  >
                    {copiedKey === 'proof' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>คัดลอก</span>
                      </>
                    )}
                  </button>
                </div>
                {isUrlProof ? (
                  <a
                    href={job.workProof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1.5 break-all font-mono text-xs text-blue-600 hover:underline"
                  >
                    <span>{job.workProof}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-1.5 break-all font-mono text-xs text-slate-800">{job.workProof}</p>
                )}
              </div>
            )}
          </div>

          {/* Role-Aware Action Panel */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">ดำเนินการตาม Smart Contract</h3>
              <span className="text-xs text-slate-500">{stateMeta.description}</span>
            </div>

            {actionError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {actionError}
              </div>
            )}

            {/* State 0: Created */}
            {job.state === JobState.Created && (
              role === 'client' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-600">
                    โอนเงินค่าจ้างจำนวน{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {formatEthFromWei(job.amountWei)} ETH
                    </span>{' '}
                    เข้าสู่ Smart Contract Escrow เพื่อเริ่มต้นงาน
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    onClick={() => runAction('deposit', () => onDepositPayment(job))}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {busyAction === 'deposit'
                        ? 'กำลังโอนเข้า Escrow...'
                        : `ฝากเงิน ${formatEthFromWei(job.amountWei)} ETH เข้า Escrow`}
                    </span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  รอผู้ว่าจ้าง ({shortenAddress(job.client)}) ฝากเงินค่าจ้างเข้าสู่ Smart Contract ก่อนเริ่มส่งมอบงาน
                </p>
              )
            )}

            {/* State 1: Funded */}
            {job.state === JobState.Funded && (
              <div className="space-y-4">
                {role === 'freelancer' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!workProofInput.trim()) {
                        setActionError('กรุณาระบุ URL หรือ Hash ของไฟล์ผลงานก่อนส่งมอบ');
                        return;
                      }
                      runAction('submit', () => onSubmitWork(job, workProofInput));
                    }}
                    className="space-y-2.5"
                  >
                    <label htmlFor="work-proof-input" className="block text-xs font-medium text-slate-700">
                      ส่งมอบหลักฐานงาน (URL ของผลงาน / GitHub Commit / IPFS Hash)
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="work-proof-input"
                        type="text"
                        value={workProofInput}
                        onChange={(e) => setWorkProofInput(e.target.value)}
                        placeholder="https://github.com/... หรือ ipfs://..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={Boolean(busyAction)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {busyAction === 'submit' ? 'กำลังส่งมอบงาน...' : 'บันทึกการส่งมอบงาน'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-slate-600">
                    เงินค่าจ้างถูกล็อกใน Escrow แล้ว — กำลังรอฟรีแลนซ์ ({shortenAddress(job.freelancer)}) ส่งมอบงาน
                  </p>
                )}

                {(role === 'client' || role === 'freelancer') && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <span className="text-xs text-slate-500">
                      หากเกิดปัญหาเรื่องขอบเขตงานหรือการไม่ตอบสนอง สามารถแจ้งข้อพิพาทให้ Admin ตรวจสอบ
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => runAction('dispute', () => onRaiseDispute(job))}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      {busyAction === 'dispute' ? 'กำลังแจ้งข้อพิพาท...' : 'แจ้งข้อพิพาท'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* State 2: Submitted */}
            {job.state === JobState.Submitted && (
              <div className="space-y-3">
                {role === 'client' ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-600">
                      ตรวจสอบหลักฐานงานด้านบน หากถูกต้องครบถ้วน กดยืนยันเพื่อโอน{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {formatEthFromWei(job.amountWei)} ETH
                      </span>{' '}
                      ให้ฟรีแลนซ์ทันที
                    </p>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => runAction('dispute', () => onRaiseDispute(job))}
                        className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        {busyAction === 'dispute' ? 'กำลังแจ้ง...' : 'แจ้งข้อพิพาท'}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => runAction('release', () => onApproveAndRelease(job))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {busyAction === 'release' ? 'กำลังโอนเงิน...' : 'อนุมัติและจ่ายเงิน'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-600">
                      ส่งมอบงานแล้ว — รอผู้ว่าจ้างตรวจสอบและอนุมัติจ่ายเงิน (ไม่อนุญาตให้เบิกเงินก่อนการอนุมัติ)
                    </p>
                    {role === 'freelancer' && (
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => runAction('dispute', () => onRaiseDispute(job))}
                        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {busyAction === 'dispute' ? 'กำลังแจ้ง...' : 'แจ้งข้อพิพาท'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* State 3: Disputed */}
            {job.state === JobState.Disputed && (
              role === 'admin' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      คุณอยู่ในฐานะผู้ดูแลระบบ (Admin) — เลือกตัดสินการโอนเงินจำนวน{' '}
                      <span className="font-mono font-semibold">{formatEthFromWei(job.amountWei)} ETH</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => runAction('refund', () => onResolveDispute(job, false))}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {busyAction === 'refund' ? 'กำลังคืนเงิน...' : 'ตัดสินคืนเงินผู้ว่าจ้าง'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => runAction('payout', () => onResolveDispute(job, true))}
                      className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {busyAction === 'payout' ? 'กำลังจ่ายเงิน...' : 'ตัดสินจ่ายให้ฟรีแลนซ์'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-700">
                  สัญญานี้อยู่ในสถานะข้อพิพาท — เงินถูกระงับไว้ใน Smart Contract และมีเพียงผู้ดูแลระบบ ({shortenAddress(adminAddress)}) เท่านั้นที่ตัดสินได้
                </p>
              )
            )}

            {/* State 4 or 5: Finalized */}
            {(job.state === JobState.Completed || job.state === JobState.Refunded) && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {job.state === JobState.Completed
                    ? 'ธุรกรรมปิดสมบูรณ์แล้ว — Smart Contract ล็อกสถานะเพื่อป้องกันการจ่ายเงินซ้ำ (Double Payment Protection)'
                    : 'คืนเงินให้ผู้ว่าจ้างเรียบร้อยแล้ว — สัญญาปิดสมบูรณ์'}
                </span>
              </div>
            )}
          </div>

          {/* Job Specific Transaction Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700">ประวัติธุรกรรมของสัญญานี้</h3>
            {jobTransactions.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                ยังไม่มีประวัติ Event ที่ดึงได้ในรอบบล็อกล่าสุด
              </p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {jobTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-900">
                        {EVENT_LABEL_MAP[tx.eventType]}
                      </span>
                      <span className="ml-2 text-slate-500">
                        โดย <span className="font-mono">{shortenAddress(tx.actor)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-slate-600 tabular-nums">
                      {tx.amountWei && (
                        <span className="font-semibold text-slate-900">
                          {formatEthFromWei(tx.amountWei)} ETH
                        </span>
                      )}
                      {mode === 'sepolia' && !tx.isSimulated ? (
                        <a
                          href={getEtherscanTxUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <span>{shortenAddress(tx.txHash, 8, 6)}</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span>{shortenAddress(tx.txHash, 8, 6)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
