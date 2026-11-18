import { CheckCircle2, ExternalLink, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContractInspector } from './components/ContractInspector';
import { CreateContractModal } from './components/CreateContractModal';
import { EvidenceDriveView } from './components/EvidenceDriveView';
import { JobDetailModal } from './components/JobDetailModal';
import { JobLedger } from './components/JobLedger';
import { MetricsStrip } from './components/MetricsStrip';
import { SidebarNav } from './components/SidebarNav';
import { NavSection, TopBar } from './components/TopBar';
import { TransactionHistory } from './components/TransactionHistory';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import {
  CONTRACT_ADDRESS,
  DEFAULT_DEPLOYED_ADMIN,
  getEtherscanTxUrl,
  parseContractError,
  shortenAddress,
} from './lib/contract';
import {
  approveAndReleaseSandbox,
  computeEscrowMetrics,
  createInitialSandboxState,
  createSandboxJob,
  depositSandboxPayment,
  raiseSandboxDispute,
  resolveSandboxDispute,
  submitSandboxWork,
} from './lib/escrowEngine';
import {
  connectInjectedWallet,
  fetchSepoliaContractSnapshot,
  hasInjectedWallet,
  readConnectedWalletState,
  sendApproveAndRelease,
  sendCreateContract,
  sendDepositPayment,
  sendRaiseDispute,
  sendResolveDispute,
  sendSubmitWork,
  switchToSepoliaNetwork,
} from './lib/sepoliaService';
import {
  CreateContractInput,
  ExecutionMode,
  JobItem,
  JobState,
  SandboxState,
  TransactionRecord,
} from './lib/types';

const SANDBOX_STORAGE_KEY = 'digitalwork-escrow-sandbox-v1';

function loadInitialSandboxState(): SandboxState {
  if (typeof window === 'undefined') return createInitialSandboxState();
  try {
    const raw = window.localStorage.getItem(SANDBOX_STORAGE_KEY);
    if (!raw) return createInitialSandboxState();
    const parsed = JSON.parse(raw) as SandboxState;
    if (Array.isArray(parsed.jobs) && parsed.accounts?.client && parsed.accounts?.freelancer) {
      return parsed;
    }
  } catch {
    // Fallback to clean seed state
  }
  return createInitialSandboxState();
}

function getInitialMode(): ExecutionMode {
  if (typeof window === 'undefined') return 'sepolia';
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'sandbox' ? 'sandbox' : 'sepolia';
}

interface ToastBanner {
  id: string;
  type: 'success' | 'error';
  message: string;
  txHash?: string;
  isSepoliaTx?: boolean;
}

export default function App() {
  const [mode, setMode] = useState<ExecutionMode>(getInitialMode);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');

  // Live Sepolia state
  const [liveAdmin, setLiveAdmin] = useState<string>(DEFAULT_DEPLOYED_ADMIN);
  const [liveJobCount, setLiveJobCount] = useState<number>(0);
  const [liveContractBalanceWei, setLiveContractBalanceWei] = useState<string>('0');
  const [liveJobs, setLiveJobs] = useState<JobItem[]>([]);
  const [liveTransactions, setLiveTransactions] = useState<TransactionRecord[]>([]);
  const [liveLatestBlock, setLiveLatestBlock] = useState<number | null>(null);
  const [liveRpcUrl, setLiveRpcUrl] = useState<string | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Connected wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletBalanceWei, setWalletBalanceWei] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);

  // Sandbox state
  const [sandboxState, setSandboxState] = useState<SandboxState>(loadInitialSandboxState);
  const [activeSandboxRole, setActiveSandboxRole] = useState<'client' | 'freelancer' | 'admin'>('client');

  // Modals & notifications
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastBanner | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string, txHash?: string, isSepoliaTx?: boolean) => {
      setToast({
        id: String(Date.now()),
        type,
        message,
        txHash,
        isSepoliaTx,
      });
    },
    []
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxState));
    } catch {
      // Ignore storage quota errors
    }
  }, [sandboxState]);

  const refreshLiveSepolia = useCallback(async () => {
    setIsLoadingLive(true);
    setLiveError(null);
    try {
      const snapshot = await fetchSepoliaContractSnapshot();
      setLiveAdmin(snapshot.admin);
      setLiveJobCount(snapshot.jobCount);
      setLiveContractBalanceWei(snapshot.contractBalanceWei);
      setLiveJobs(snapshot.jobs);
      setLiveTransactions(snapshot.transactions);
      setLiveLatestBlock(snapshot.latestBlock);
      setLiveRpcUrl(snapshot.rpcUrl);
    } catch (err) {
      setLiveError(parseContractError(err));
    } finally {
      setIsLoadingLive(false);
    }
  }, []);

  const syncWallet = useCallback(async () => {
    try {
      const conn = await readConnectedWalletState();
      if (conn) {
        setWalletAddress(conn.address);
        setWalletChainId(conn.chainId);
        setWalletBalanceWei(conn.balanceWei);
      } else {
        setWalletAddress(null);
        setWalletChainId(null);
        setWalletBalanceWei(null);
      }
    } catch {
      // Ignore silent check errors
    }
  }, []);

  useEffect(() => {
    refreshLiveSepolia();
    syncWallet();

    const ethereum = (window as unknown as {
      ethereum?: {
        on?: (event: string, cb: () => void) => void;
        removeListener?: (event: string, cb: () => void) => void;
      };
    }).ethereum;

    if (ethereum?.on && ethereum?.removeListener) {
      const handleWalletChange = () => {
        syncWallet();
        refreshLiveSepolia();
      };
      ethereum.on('accountsChanged', handleWalletChange);
      ethereum.on('chainChanged', handleWalletChange);
      return () => {
        ethereum.removeListener?.('accountsChanged', handleWalletChange);
        ethereum.removeListener?.('chainChanged', handleWalletChange);
      };
    }
  }, [refreshLiveSepolia, syncWallet]);

  const handleConnectWallet = async () => {
    if (!hasInjectedWallet()) {
      showToast(
        'error',
        'ไม่พบ MetaMask ในเบราว์เซอร์ — คุณสามารถติดตั้ง MetaMask หรือสลับเป็นโหมดทดลอง (Sandbox) เพื่อใช้งานได้ทันที'
      );
      return;
    }
    setIsConnectingWallet(true);
    try {
      const conn = await connectInjectedWallet();
      setWalletAddress(conn.address);
      setWalletChainId(conn.chainId);
      setWalletBalanceWei(conn.balanceWei);
      showToast('success', `เชื่อมต่อกระเป๋า ${shortenAddress(conn.address)} สำเร็จ`);
    } catch (err) {
      showToast('error', parseContractError(err));
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleSwitchToSepolia = async () => {
    try {
      await switchToSepoliaNetwork();
      await syncWallet();
      showToast('success', 'สลับเครือข่ายเป็น Ethereum Sepolia แล้ว');
    } catch (err) {
      showToast('error', parseContractError(err));
    }
  };

  // Unified active data projection based on mode
  const activeJobs = mode === 'sepolia' ? liveJobs : sandboxState.jobs;
  const activeTransactions = mode === 'sepolia' ? liveTransactions : sandboxState.transactions;
  const activeAdmin = mode === 'sepolia' ? liveAdmin : sandboxState.admin;
  const activeContractBalanceWei =
    mode === 'sepolia' ? liveContractBalanceWei : sandboxState.contractBalanceWei;
  const activeJobCount = mode === 'sepolia' ? liveJobCount : sandboxState.jobCount;
  const currentUserAddress =
    mode === 'sepolia' ? walletAddress : sandboxState.accounts[activeSandboxRole].address;

  const metrics = useMemo(
    () => computeEscrowMetrics(activeJobs, activeContractBalanceWei),
    [activeJobs, activeContractBalanceWei]
  );

  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === selectedJobId) ?? null,
    [activeJobs, selectedJobId]
  );

  // Action handlers supporting both Sepolia On-Chain and Sandbox modes
  const handleCreateContract = async (input: CreateContractInput) => {
    if (mode === 'sepolia') {
      if (!walletAddress) {
        throw new Error('กรุณาเชื่อมต่อ MetaMask ก่อนสร้างสัญญาบน Sepolia');
      }
      try {
        const txHash = await sendCreateContract(input);
        await Promise.all([refreshLiveSepolia(), syncWallet()]);
        showToast('success', 'สร้างข้อตกลงการจ้างงานบน Sepolia สำเร็จ', txHash, true);
      } catch (err) {
        throw new Error(parseContractError(err));
      }
      return;
    }

    const actor = sandboxState.accounts[activeSandboxRole].address;
    const result = createSandboxJob(sandboxState, actor, input);
    if (!result.ok) throw new Error(result.error);
    setSandboxState(result.state);
    showToast('success', `สร้างสัญญา #${result.jobId} ในโหมดทดลองสำเร็จ`, result.txHash, false);
  };

  const handleDepositPayment = async (job: JobItem) => {
    if (mode === 'sepolia') {
      if (!walletAddress) {
        throw new Error('กรุณาเชื่อมต่อ MetaMask ก่อนฝากเงินเข้า Escrow');
      }
      try {
        const txHash = await sendDepositPayment(job.id, job.amountWei);
        await Promise.all([refreshLiveSepolia(), syncWallet()]);
        showToast('success', `ฝากเงินเข้า Escrow สำหรับสัญญา #${job.id} สำเร็จ`, txHash, true);
      } catch (err) {
        throw new Error(parseContractError(err));
      }
      return;
    }

    const actor = sandboxState.accounts[activeSandboxRole].address;
    const result = depositSandboxPayment(sandboxState, actor, job.id, BigInt(job.amountWei));
    if (!result.ok) throw new Error(result.error);
    setSandboxState(result.state);
    showToast('success', `ฝากเงินเข้า Escrow สำหรับสัญญา #${job.id} สำเร็จ`, result.txHash, false);
  };

  const handleSubmitWork = async (job: JobItem, workProof: string) => {
    if (mode === 'sepolia') {
      if (!walletAddress) {
        throw new Error('กรุณาเชื่อมต่อ MetaMask ก่อนส่งมอบงาน');
      }
      try {
        const txHash = await sendSubmitWork(job.id, workProof);
        await Promise.all([refreshLiveSepolia(), syncWallet()]);
        showToast('success', `ส่งมอบงานสัญญา #${job.id} สำเร็จ`, txHash, true);
      } catch (err) {
        throw new Error(parseContractError(err));
      }
      return;
    }

    const actor = sandboxState.accounts[activeSandboxRole].address;
    const result = submitSandboxWork(sandboxState, actor, job.id, workProof);
    if (!result.ok) throw new Error(result.error);
    setSandboxState(result.state);
    showToast('success', `บันทึกหลักฐานส่งมอบงานสัญญา #${job.id} สำเร็จ`, result.txHash, false);
  };

  const handleApproveAndRelease = async (job: JobItem) => {
    if (mode === 'sepolia') {
      if (!walletAddress) {
        throw new Error('กรุณาเชื่อมต่อ MetaMask ก่อนอนุมัติจ่ายเงิน');
      }
      try {
        const txHash = await sendApproveAndRelease(job.id);
        await Promise.all([refreshLiveSepolia(), syncWallet()]);
        showToast('success', `อนุมัติและโอนเงินสัญญา #${job.id} ให้ฟรีแลนซ์สำเร็จ`, txHash, true);
      } catch (err) {
        throw new Error(parseContractError(err));
      }
      return;
    }

    const actor = sandboxState.accounts[activeSandboxRole].address;
    const result = approveAndReleaseSandbox(sandboxState, actor, job.id);
    if (!result.ok) throw new Error(result.error);
    setSandboxState(result.state);
    showToast('success', `อนุมัติและโอนเงินสัญญา #${job.id} ให้ฟรีแลนซ์สำเร็จ`, result.txHash, false);
  };

  const handleRaiseDispute = async (job: JobItem) => {
    if (mode === 'sepolia') {
      if (!walletAddress) {
        throw new Error('กรุณาเชื่อมต่อ MetaMask ก่อนแจ้งข้อพิพาท');
      }
      try {
        const txHash = await sendRaiseDispute(job.id);
        await Promise.all([refreshLiveSepolia(), syncWallet()]);
        showToast('success', `บันทึกข้อพิพาทสัญญา #${job.id} บนเชนแล้ว`, txHash, true);
      } catch (err) {
        throw new Error(parseContractError(err));
      }
      return;
    }

    const actor = sandboxState.accounts[activeSandboxRole].address;
    const result = raiseSandboxDispute(sandboxState, actor, job.id);
    if (!result.ok) throw new Error(result.error);
    setSandboxState(result.state);
    showToast('success', `แจ้งข้อพิพาทสัญญา #${job.id} เรียบร้อยแล้ว`, result.txHash, false);
  };

  const handleResolveDispute = async (job: JobItem, releaseToFreelancer: boolean) => {
    if (mode === 'sepolia') {
      if (!walletAddress) {
        throw new Error('กรุณาเชื่อมต่อกระเป๋า Admin ก่อนตัดสินข้อพิพาท');
      }
      try {
        const txHash = await sendResolveDispute(job.id, releaseToFreelancer);
        await Promise.all([refreshLiveSepolia(), syncWallet()]);
        showToast(
          'success',
          releaseToFreelancer
            ? `ตัดสินจ่ายเงินสัญญา #${job.id} ให้ฟรีแลนซ์สำเร็จ`
            : `ตัดสินคืนเงินสัญญา #${job.id} ให้ผู้ว่าจ้างสำเร็จ`,
          txHash,
          true
        );
      } catch (err) {
        throw new Error(parseContractError(err));
      }
      return;
    }

    const actor = sandboxState.accounts[activeSandboxRole].address;
    const result = resolveSandboxDispute(sandboxState, actor, job.id, releaseToFreelancer);
    if (!result.ok) throw new Error(result.error);
    setSandboxState(result.state);
    showToast(
      'success',
      releaseToFreelancer
        ? `ตัดสินจ่ายเงินสัญญา #${job.id} ให้ฟรีแลนซ์สำเร็จ`
        : `ตัดสินคืนเงินสัญญา #${job.id} ให้ผู้ว่าจ้างสำเร็จ`,
      result.txHash,
      false
    );
  };

  const handleResetSandbox = () => {
    const fresh = createInitialSandboxState();
    setSandboxState(fresh);
    setActiveSandboxRole('client');
    setSelectedJobId(null);
    showToast('success', 'รีเซ็ตข้อมูลจำลอง Sandbox เรียบร้อยแล้ว');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        mode={mode}
        walletAddress={walletAddress}
        walletChainId={walletChainId}
        isConnectingWallet={isConnectingWallet}
        onConnectWallet={handleConnectWallet}
        onSwitchToSepolia={handleSwitchToSepolia}
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <SidebarNav
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          disputedCount={activeJobs.filter((j) => j.state === JobState.Disputed).length}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          <WorkspaceToolbar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            mode={mode}
            onChangeMode={(nextMode) => {
              setMode(nextMode);
              setSelectedJobId(null);
            }}
            sandboxAccounts={sandboxState.accounts}
            activeSandboxRole={activeSandboxRole}
            onChangeSandboxRole={setActiveSandboxRole}
            onResetSandbox={handleResetSandbox}
            onRefreshLive={refreshLiveSepolia}
            isRefreshing={isLoadingLive}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            walletAddress={walletAddress}
            walletBalanceWei={walletBalanceWei}
          />

          {toast && (
            <div
              role="status"
              className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
                toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{toast.message}</span>
                {toast.txHash && (
                  toast.isSepoliaTx ? (
                    <a
                      href={getEtherscanTxUrl(toast.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono underline"
                    >
                      <span>{shortenAddress(toast.txHash, 8, 6)}</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="font-mono text-slate-600">
                      ({shortenAddress(toast.txHash, 8, 6)})
                    </span>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="ปิดการแจ้งเตือน"
                className="rounded p-1 hover:bg-black/5 shrink-0"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {activeSection === 'overview' && (
            <div className="space-y-6">
              <MetricsStrip
                metrics={metrics}
                isLoading={mode === 'sepolia' && isLoadingLive}
              />
              <JobLedger
                jobs={activeJobs}
                isLoading={mode === 'sepolia' && isLoadingLive}
                errorMessage={mode === 'sepolia' ? liveError : null}
                mode={mode}
                currentUserAddress={currentUserAddress}
                adminAddress={activeAdmin}
                onSelectJob={(job) => setSelectedJobId(job.id)}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
                onSwitchToSandbox={() => setMode('sandbox')}
                onRetryLoad={refreshLiveSepolia}
              />
            </div>
          )}

          {activeSection === 'transactions' && (
            <TransactionHistory
              transactions={activeTransactions}
              isLoading={mode === 'sepolia' && isLoadingLive}
              mode={mode}
            />
          )}

          {activeSection === 'contract' && (
            <ContractInspector
              adminAddress={activeAdmin}
              jobCount={activeJobCount}
              contractBalanceWei={activeContractBalanceWei}
              latestBlock={liveLatestBlock}
              rpcUrl={liveRpcUrl}
            />
          )}

          {activeSection === 'evidence' && <EvidenceDriveView />}

          <footer className="border-t border-slate-200 pt-5 pb-4 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              DigitalWork Solutions · แพลตฟอร์ม Freelance Escrow &amp; Smart Payment บน Ethereum Sepolia
            </div>
            <div className="font-mono">
              Contract: {shortenAddress(CONTRACT_ADDRESS, 8, 6)}
            </div>
          </footer>
        </main>
      </div>

      <CreateContractModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        mode={mode}
        callerAddress={currentUserAddress ?? ''}
        onSubmitContract={handleCreateContract}
      />

      <JobDetailModal
        job={selectedJob}
        transactions={activeTransactions}
        mode={mode}
        currentUserAddress={currentUserAddress}
        adminAddress={activeAdmin}
        onClose={() => setSelectedJobId(null)}
        onDepositPayment={handleDepositPayment}
        onSubmitWork={handleSubmitWork}
        onApproveAndRelease={handleApproveAndRelease}
        onRaiseDispute={handleRaiseDispute}
        onResolveDispute={handleResolveDispute}
      />
    </div>
  );
}
