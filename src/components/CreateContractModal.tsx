import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { safeParseEther } from '../lib/contract';
import { SANDBOX_ADDRESSES, validateCreateContractInput } from '../lib/escrowEngine';
import { CreateContractInput, ExecutionMode } from '../lib/types';

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ExecutionMode;
  callerAddress: string;
  onSubmitContract: (input: CreateContractInput) => Promise<void>;
}

function getDefaultDeadlineIso(daysAhead = 7): string {
  const date = new Date(Date.now() + daysAhead * 86400 * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CreateContractModal({
  isOpen,
  onClose,
  mode,
  callerAddress,
  onSubmitContract,
}: CreateContractModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountEth, setAmountEth] = useState('0.1');
  const [deadlineIso, setDeadlineIso] = useState(() => getDefaultDeadlineIso(7));
  const [freelancerAddress, setFreelancerAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const parsedWei = safeParseEther(amountEth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateCreateContractInput(
      {
        title,
        description,
        amountEth,
        deadlineIso,
        freelancerAddress,
      },
      callerAddress
    );

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitContract({
        title,
        description,
        amountEth,
        deadlineIso,
        freelancerAddress,
      });
      setTitle('');
      setDescription('');
      setAmountEth('0.1');
      setDeadlineIso(getDefaultDeadlineIso(7));
      setFreelancerAddress('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถสร้างข้อตกลงได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-contract-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="create-contract-title" className="font-display text-lg font-semibold text-slate-900">
              สร้างข้อตกลงการจ้างงาน (Create Contract)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {mode === 'sepolia'
                ? 'บันทึกรายละเอียดงานและ Address ฟรีแลนซ์ลงบน Ethereum Sepolia'
                : 'สร้างข้อตกลงจำลองด้วยกฎการตรวจสอบเดียวกับ Smart Contract'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="ปิดหน้าต่างสร้างข้อตกลง"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="contract-title" className="block text-xs font-medium text-slate-700">
              ชื่อโครงการ <span className="text-red-600">*</span>
            </label>
            <input
              id="contract-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น พัฒนาเว็บไซต์บริษัทและระบบหลังบ้าน"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="contract-description" className="block text-xs font-medium text-slate-700">
              รายละเอียดงานและเงื่อนไขการส่งมอบ <span className="text-red-600">*</span>
            </label>
            <textarea
              id="contract-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุขอบเขตงาน ฟังก์ชันที่ต้องส่งมอบ และรูปแบบไฟล์ผลงาน..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contract-amount" className="block text-xs font-medium text-slate-700">
                ค่าจ้าง (ETH) <span className="text-red-600">*</span>
              </label>
              <input
                id="contract-amount"
                type="text"
                inputMode="decimal"
                value={amountEth}
                onChange={(e) => setAmountEth(e.target.value)}
                placeholder="0.1"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                required
              />
              <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                {parsedWei !== null ? `${parsedWei.toString()} Wei` : 'จำนวน Wei ไม่ถูกต้อง'}
              </p>
            </div>

            <div>
              <label htmlFor="contract-deadline" className="block text-xs font-medium text-slate-700">
                กำหนดส่งงาน <span className="text-red-600">*</span>
              </label>
              <input
                id="contract-deadline"
                type="datetime-local"
                value={deadlineIso}
                onChange={(e) => setDeadlineIso(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                required
              />
              <div className="mt-1.5 flex items-center gap-2">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDeadlineIso(getDefaultDeadlineIso(days))}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                  >
                    +{days} วัน
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="contract-freelancer" className="block text-xs font-medium text-slate-700">
                Wallet Address ของฟรีแลนซ์ <span className="text-red-600">*</span>
              </label>
              {mode === 'sandbox' && (
                <button
                  type="button"
                  onClick={() => setFreelancerAddress(SANDBOX_ADDRESSES.freelancer)}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  ใช้ Address ฟรีแลนซ์ทดลอง
                </button>
              )}
            </div>
            <input
              id="contract-freelancer"
              type="text"
              value={freelancerAddress}
              onChange={(e) => setFreelancerAddress(e.target.value)}
              placeholder="0x..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500">
              ต้องไม่ใช่ Address เดียวกับผู้ว่าจ้าง และไม่ใช่ 0x000...000
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isSubmitting
                ? mode === 'sepolia'
                  ? 'กำลังส่งธุรกรรม...'
                  : 'กำลังบันทึก...'
                : 'ยืนยันสร้างข้อตกลง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
