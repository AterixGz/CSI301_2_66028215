import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Search,
  Send,
  Undo2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  JOB_STATE_META,
  formatEthFromWei,
  formatThaiDateTime,
  shortenAddress,
} from '../lib/contract';
import { getUserRoleForJob } from '../lib/escrowEngine';
import { ExecutionMode, JobItem, JobState } from '../lib/types';

interface JobLedgerProps {
  jobs: JobItem[];
  isLoading: boolean;
  errorMessage: string | null;
  mode: ExecutionMode;
  currentUserAddress: string | null;
  adminAddress: string;
  onSelectJob: (job: JobItem) => void;
  onOpenCreateModal: () => void;
  onSwitchToSandbox: () => void;
  onRetryLoad: () => void;
}

const FILTER_OPTIONS: Array<{ value: 'all' | JobState; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: JobState.Created, label: 'สร้างข้อตกลงแล้ว' },
  { value: JobState.Funded, label: 'ฝากเงินแล้ว' },
  { value: JobState.Submitted, label: 'ส่งงานแล้ว' },
  { value: JobState.Disputed, label: 'เกิดข้อพิพาท' },
  { value: JobState.Completed, label: 'เสร็จสมบูรณ์' },
  { value: JobState.Refunded, label: 'คืนเงินแล้ว' },
];

function StateIcon({ state }: { state: JobState }) {
  switch (state) {
    case JobState.Created:
      return <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />;
    case JobState.Funded:
      return <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />;
    case JobState.Submitted:
      return <Send className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />;
    case JobState.Disputed:
      return <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />;
    case JobState.Completed:
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />;
    case JobState.Refunded:
      return <Undo2 className="h-3.5 w-3.5 text-slate-600 shrink-0" aria-hidden="true" />;
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'client':
      return 'ผู้ว่าจ้าง';
    case 'freelancer':
      return 'ฟรีแลนซ์';
    case 'admin':
      return 'Admin';
    default:
      return '';
  }
}

export function JobLedger({
  jobs,
  isLoading,
  errorMessage,
  mode,
  currentUserAddress,
  adminAddress,
  onSelectJob,
  onOpenCreateModal,
  onSwitchToSandbox,
  onRetryLoad,
}: JobLedgerProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | JobState>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== 'all' && job.state !== statusFilter) return false;
      if (!q) return true;
      return (
        String(job.id) === q ||
        `#${job.id}` === q ||
        job.title.toLowerCase().includes(q) ||
        job.client.toLowerCase().includes(q) ||
        job.freelancer.toLowerCase().includes(q)
      );
    });
  }, [jobs, statusFilter, searchQuery]);

  return (
    <section aria-label="รายการสัญญาจ้างงาน Escrow" className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              รายการสัญญาจ้างงานและสถานะ Escrow
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              ตรวจสอบรายละเอียด หลักฐานการส่งมอบงาน และดำเนินการตามบทบาทคู่สัญญา
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="job-search-input" className="sr-only">
              ค้นหาตามรหัสงาน ชื่อโครงการ หรือ Wallet Address
            </label>
            <input
              id="job-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา ID, ชื่อโครงการ, 0x..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto pb-1"
          role="tablist"
          aria-label="กรองตามสถานะงาน"
        >
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="tab"
              aria-selected={statusFilter === opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-red-700">{errorMessage}</p>
          <button
            type="button"
            onClick={onRetryLoad}
            className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            ลองเชื่อมต่อใหม่
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="divide-y divide-slate-100" aria-busy="true" aria-label="กำลังโหลดข้อมูลสัญญา">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between px-5 py-4 animate-pulse">
              <div className="space-y-2 w-2/3">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="h-3 w-72 rounded bg-slate-100" />
              </div>
              <div className="h-8 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <FileText className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <h3 className="mt-3 font-display text-sm font-semibold text-slate-900">
            {jobs.length === 0
              ? mode === 'sepolia'
                ? 'ยังไม่มีสัญญาจ้างงานบน Smart Contract Sepolia นี้'
                : 'ยังไม่มีรายการสัญญาจ้างงาน'
              : 'ไม่พบสัญญาที่ตรงกับตัวกรอง'}
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
            {jobs.length === 0 && mode === 'sepolia'
              ? 'สัญญา 0xA915...dAA0 พร้อมใช้งานแล้ว คุณสามารถเชื่อมต่อ MetaMask เพื่อสร้างข้อตกลงแรกบนเชนจริง หรือเปิดโหมดทดลองใช้งานเพื่อทดสอบทุกขั้นตอนได้ทันที'
              : 'เริ่มต้นด้วยการสร้างข้อตกลงการจ้างงานใหม่เพื่อกำหนดค่าจ้าง กำหนดส่ง และ Address ของฟรีแลนซ์'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              สร้างข้อตกลงแรก
            </button>
            {mode === 'sepolia' && jobs.length === 0 && (
              <button
                type="button"
                onClick={onSwitchToSandbox}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                ทดลองใช้งานในโหมด Sandbox
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 whitespace-nowrap">รหัส</th>
                <th className="py-3 px-3">โครงการและกำหนดส่ง</th>
                <th className="py-3 px-3 whitespace-nowrap">คู่สัญญา (ผู้ว่าจ้าง / ฟรีแลนซ์)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ค่าจ้าง (ETH)</th>
                <th className="py-3 px-3 whitespace-nowrap">สถานะ</th>
                <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredJobs.map((job) => {
                const stateMeta = JOB_STATE_META[job.state];
                const role = getUserRoleForJob(currentUserAddress, job, adminAddress);
                const roleLabel = getRoleLabel(role);

                return (
                  <tr
                    key={job.id}
                    className="group hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 pl-5 pr-3 font-mono text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap align-top">
                      #{job.id}
                    </td>

                    <td className="py-3.5 px-3 min-w-[240px] max-w-[360px] align-top">
                      <div className="font-medium text-slate-900 leading-snug">
                        {job.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>กำหนดส่ง {formatThaiDateTime(job.deadline)}</span>
                        {roleLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-blue-700">บทบาทของคุณ: {roleLabel}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap align-top">
                      <div>ผู้ว่าจ้าง: {shortenAddress(job.client)}</div>
                      <div className="mt-0.5 text-slate-500">
                        ฟรีแลนซ์: {shortenAddress(job.freelancer)}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap align-top">
                      {formatEthFromWei(job.amountWei)} ETH
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap align-top">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${stateMeta.textClass}`}>
                        <StateIcon state={job.state} />
                        <span>{stateMeta.labelTh}</span>
                      </span>
                    </td>

                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => onSelectJob(job)}
                        aria-label={`จัดการสัญญา #${job.id} ${job.title}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <span>จัดการสัญญา</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
