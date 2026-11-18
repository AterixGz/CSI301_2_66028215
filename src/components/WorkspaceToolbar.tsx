import { ExternalLink, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { CONTRACT_ADDRESS, formatEthFromWei, getEtherscanAddressUrl, shortenAddress } from '../lib/contract';
import { ExecutionMode, SandboxAccount } from '../lib/types';
import { NavSection } from './TopBar';

interface WorkspaceToolbarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  mode: ExecutionMode;
  onChangeMode: (mode: ExecutionMode) => void;
  sandboxAccounts: Record<'client' | 'freelancer' | 'admin', SandboxAccount>;
  activeSandboxRole: 'client' | 'freelancer' | 'admin';
  onChangeSandboxRole: (role: 'client' | 'freelancer' | 'admin') => void;
  onResetSandbox: () => void;
  onRefreshLive: () => void;
  isRefreshing: boolean;
  onOpenCreateModal: () => void;
  walletAddress: string | null;
  walletBalanceWei: string | null;
}

export function WorkspaceToolbar({
  activeSection,
  onSelectSection,
  mode,
  onChangeMode,
  sandboxAccounts,
  activeSandboxRole,
  onChangeSandboxRole,
  onResetSandbox,
  onRefreshLive,
  isRefreshing,
  onOpenCreateModal,
  walletAddress,
  walletBalanceWei,
}: WorkspaceToolbarProps) {
  const activeSandboxAccount = sandboxAccounts[activeSandboxRole];

  return (
    <div className="space-y-4 border-b border-slate-200 pb-6">
      {/* Mobile secondary navigation tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 md:hidden" role="tablist" aria-label="สลับมุมมอง">
        {(
          [
            { id: 'overview', label: 'ภาพรวมสัญญา' },
            { id: 'transactions', label: 'ประวัติธุรกรรม' },
            { id: 'contract', label: 'ข้อมูลสัญญา' },
            { id: 'evidence', label: 'หลักฐานทดสอบ' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectSection(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              activeSection === tab.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>DigitalWork Solutions</span>
            <span aria-hidden="true">/</span>
            <span>Freelance Escrow &amp; Smart Payment Platform</span>
            <span aria-hidden="true">/</span>
            <a
              href={getEtherscanAddressUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
            >
              <span>{shortenAddress(CONTRACT_ADDRESS)}</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            ระบบจ้างงานฟรีแลนซ์และชำระเงินตามผลงาน
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Execution Mode Segmented Control */}
          <div
            className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
            role="group"
            aria-label="โหมดการทำงาน"
          >
            <button
              type="button"
              onClick={() => onChangeMode('sepolia')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                mode === 'sepolia'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sepolia On-Chain
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('sandbox')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                mode === 'sandbox'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              โหมดทดลอง (Sandbox)
            </button>
          </div>

          {mode === 'sepolia' ? (
            <button
              type="button"
              onClick={onRefreshLive}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>อัปเดตข้อมูลเชน</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onResetSandbox}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>รีเซ็ต Sandbox</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>สร้างข้อตกลงใหม่</span>
          </button>
        </div>
      </div>

      {/* Active Actor Context Strip */}
      {mode === 'sandbox' ? (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center">
            <span className="font-medium text-slate-900 shrink-0">สลับบทบาทผู้ใช้งาน (Sandbox):</span>
            <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-md bg-slate-100 p-1">
              {(['client', 'freelancer', 'admin'] as const).map((roleKey) => {
                const acc = sandboxAccounts[roleKey];
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => onChangeSandboxRole(roleKey)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeSandboxRole === roleKey
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {acc.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-mono text-slate-700">
              {shortenAddress(activeSandboxAccount.address, 6, 4)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              ยอดคงเหลือ {formatEthFromWei(activeSandboxAccount.balanceWei)} ETH
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">
            กำลังเชื่อมต่อสัญญาจริงบน <span className="font-medium text-slate-900">Ethereum Sepolia Testnet</span> — อ่านสถานะตรงจาก Smart Contract{' '}
            <span className="font-mono text-slate-800">{shortenAddress(CONTRACT_ADDRESS)}</span>
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            {walletAddress ? (
              <span className="font-mono text-slate-900">
                กระเป๋าของคุณ: {shortenAddress(walletAddress)} ·{' '}
                {walletBalanceWei ? `${formatEthFromWei(walletBalanceWei)} SepoliaETH` : '...'}
              </span>
            ) : (
              <span>โหมดอ่านข้อมูลอย่างเดียว — กด &ldquo;เชื่อมต่อ Wallet&rdquo; เพื่อทำธุรกรรมจริง</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
