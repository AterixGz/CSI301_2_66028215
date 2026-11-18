import { Check, Copy, ExternalLink, FileCode2, FolderUp, History, LayoutGrid, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { CONTRACT_ADDRESS, getEtherscanAddressUrl, shortenAddress } from '../lib/contract';
import { NavSection } from './TopBar';

interface SidebarNavProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onOpenCreateModal: () => void;
  disputedCount: number;
}

const WORKFLOW_STEPS = [
  '01. สร้างข้อตกลงการจ้างงาน',
  '02. ฝากเงิน ETH เข้า Escrow',
  '03. ฟรีแลนซ์ส่งมอบหลักฐานงาน',
  '04. ตรวจรับและอนุมัติจ่ายเงิน',
  '05. แจ้งและระงับข้อพิพาท (Admin)',
  '06. ตรวจสอบธุรกรรมบนเชน',
];

export function SidebarNav({
  activeSection,
  onSelectSection,
  onOpenCreateModal,
  disputedCount,
}: SidebarNavProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <aside className="hidden lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] w-[256px] shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-200 bg-white px-4 py-6">
      <div className="space-y-8">
        <div>
          <p className="px-3 text-xs font-medium text-slate-500">พื้นที่ทำงาน Escrow</p>
          <nav aria-label="เมนูพื้นที่ทำงาน" className="mt-2 space-y-1">
            <button
              type="button"
              onClick={() => onSelectSection('overview')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === 'overview'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>ภาพรวมสัญญาจ้าง</span>
              </span>
              {disputedCount > 0 && (
                <span className="font-mono text-xs font-semibold text-red-700 tabular-nums">
                  {disputedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>สร้างข้อตกลงใหม่</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('transactions')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === 'transactions'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <History className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>ติดตามธุรกรรม</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('contract')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === 'contract'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FileCode2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>ข้อมูล Smart Contract</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('evidence')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === 'evidence'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FolderUp className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>หลักฐาน &amp; Google Drive</span>
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <p className="px-3 text-xs font-medium text-slate-500">ขั้นตอนการทำงานมาตรฐาน</p>
          <ol className="mt-3 space-y-2 px-3 text-xs text-slate-600 leading-relaxed">
            {WORKFLOW_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-5 space-y-2 px-2">
        <div className="text-xs text-slate-500">Sepolia Escrow Contract</div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-medium text-slate-800">
            {shortenAddress(CONTRACT_ADDRESS, 8, 6)}
          </span>
          <button
            type="button"
            onClick={handleCopyContract}
            aria-label="คัดลอกที่อยู่ Smart Contract"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
        <a
          href={getEtherscanAddressUrl(CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <span>เปิดบน Sepolia Etherscan</span>
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
