import { Wallet } from 'lucide-react';
import { shortenAddress } from '../lib/contract';
import { ExecutionMode } from '../lib/types';

export type NavSection = 'overview' | 'transactions' | 'contract' | 'evidence';

interface TopBarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onOpenCreateModal: () => void;
  mode: ExecutionMode;
  walletAddress: string | null;
  walletChainId: number | null;
  isConnectingWallet: boolean;
  onConnectWallet: () => void;
  onSwitchToSepolia: () => void;
}

export function TopBar({
  activeSection,
  onSelectSection,
  onOpenCreateModal,
  mode,
  walletAddress,
  walletChainId,
  isConnectingWallet,
  onConnectWallet,
  onSwitchToSepolia,
}: TopBarProps) {
  const isWrongChain = walletAddress !== null && walletChainId !== null && walletChainId !== 11155111;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectSection('overview')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          DigitalWork
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="เมนูหลัก" className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => onSelectSection('overview')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'overview'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ภาพรวมสัญญา
          </button>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="py-1 border-b-2 border-transparent text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            สร้างข้อตกลง
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('transactions')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'transactions'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ประวัติธุรกรรม
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('contract')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'contract'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ข้อมูลสัญญา
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('evidence')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'evidence'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            หลักฐาน &amp; Drive
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {isWrongChain && mode === 'sepolia' ? (
            <button
              type="button"
              onClick={onSwitchToSepolia}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span>สลับเป็น Sepolia</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectWallet}
              disabled={isConnectingWallet}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span className={walletAddress ? 'font-mono' : ''}>
                {isConnectingWallet
                  ? 'กำลังเชื่อมต่อ...'
                  : walletAddress
                  ? shortenAddress(walletAddress)
                  : 'เชื่อมต่อ Wallet'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
