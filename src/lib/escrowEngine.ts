import { isAddress, parseEther } from 'ethers';
import { DEFAULT_DEPLOYED_ADMIN } from './contract';
import {
  ActorRole,
  CreateContractInput,
  EscrowMetrics,
  JobItem,
  JobState,
  SandboxState,
  TransactionRecord,
} from './types';

export const SANDBOX_ADDRESSES = {
  client: '0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C',
  freelancer: '0xE0529cB8578Fefa460Bb55e1EB91813B1F2b0120',
  admin: '0x1444D0c117b02a728255F27d2DF68c87A796D225',
} as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getUserRoleForJob(
  userAddress: string | null | undefined,
  job: Pick<JobItem, 'client' | 'freelancer'>,
  adminAddress: string
): ActorRole {
  if (!userAddress) return 'viewer';
  const normalized = userAddress.toLowerCase();
  if (normalized === job.client.toLowerCase()) return 'client';
  if (normalized === job.freelancer.toLowerCase()) return 'freelancer';
  if (adminAddress && normalized === adminAddress.toLowerCase()) return 'admin';
  return 'viewer';
}

export function computeEscrowMetrics(
  jobs: JobItem[],
  contractBalanceWei?: string
): EscrowMetrics {
  let escrowLockedWei = 0n;
  let completedPayoutsWei = 0n;
  let activeDisputes = 0;

  for (const job of jobs) {
    const amt = BigInt(job.amountWei || '0');
    if (
      job.state === JobState.Funded ||
      job.state === JobState.Submitted ||
      job.state === JobState.Disputed
    ) {
      escrowLockedWei += amt;
    }
    if (job.state === JobState.Completed) {
      completedPayoutsWei += amt;
    }
    if (job.state === JobState.Disputed) {
      activeDisputes += 1;
    }
  }

  // If live contract balance is supplied and jobs list has items, keep live balance accurate
  if (contractBalanceWei !== undefined) {
    try {
      escrowLockedWei = BigInt(contractBalanceWei);
    } catch {
      // Fallback to computed sum
    }
  }

  return {
    totalJobs: jobs.length,
    escrowLockedWei,
    completedPayoutsWei,
    activeDisputes,
  };
}

export interface ValidatedContractParams {
  title: string;
  description: string;
  amountWei: string;
  deadlineTimestamp: number;
  freelancer: string;
}

export function validateCreateContractInput(
  input: CreateContractInput,
  callerAddress: string,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000)
): { ok: true; data: ValidatedContractParams } | { ok: false; error: string } {
  const title = input.title.trim();
  const description = input.description.trim();
  const freelancer = input.freelancerAddress.trim();
  const amountStr = input.amountEth.trim();

  if (!title) {
    return { ok: false, error: 'กรุณาระบุชื่อโครงการ' };
  }
  if (!description) {
    return { ok: false, error: 'กรุณาระบุรายละเอียดขอบเขตงาน' };
  }
  if (!isAddress(freelancer) || freelancer.toLowerCase() === ZERO_ADDRESS) {
    return { ok: false, error: 'Invalid freelancer address (รูปแบบ Wallet Address ของฟรีแลนซ์ไม่ถูกต้อง)' };
  }
  if (callerAddress && freelancer.toLowerCase() === callerAddress.toLowerCase()) {
    return { ok: false, error: 'Client and freelancer cannot be the same (ผู้ว่าจ้างและฟรีแลนซ์ต้องเป็นคนละกระเป๋ากัน)' };
  }

  let amountWeiBigInt: bigint;
  try {
    amountWeiBigInt = parseEther(amountStr);
  } catch {
    return { ok: false, error: 'กรุณาระบุจำนวนค่าจ้าง ETH เป็นตัวเลขที่ถูกต้อง' };
  }
  if (amountWeiBigInt <= 0n) {
    return { ok: false, error: 'Amount must be greater than 0 (ค่าจ้างต้องมากกว่า 0 ETH)' };
  }

  const parsedMs = Date.parse(input.deadlineIso);
  if (Number.isNaN(parsedMs)) {
    return { ok: false, error: 'กรุณาเลือกวันและเวลากำหนดส่งงานที่ถูกต้อง' };
  }
  const deadlineTimestamp = Math.floor(parsedMs / 1000);
  if (deadlineTimestamp <= nowUnixSeconds) {
    return { ok: false, error: 'Deadline must be in the future (กำหนดส่งงานต้องเป็นเวลาในอนาคต)' };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      amountWei: amountWeiBigInt.toString(),
      deadlineTimestamp,
      freelancer,
    },
  };
}

function deterministicTxHash(seed: number, step: string): string {
  const hexBase = `${seed.toString(16)}${Array.from(step)
    .map((c) => c.charCodeAt(0).toString(16))
    .join('')}`;
  return `0x${hexBase.padEnd(64, 'a9150693e7b2c4').slice(0, 64)}`;
}

export function createInitialSandboxState(nowSeconds: number = Math.floor(Date.now() / 1000)): SandboxState {
  const day = 86400;
  const jobs: JobItem[] = [
    {
      id: 1,
      client: SANDBOX_ADDRESSES.client,
      freelancer: SANDBOX_ADDRESSES.freelancer,
      title: 'พัฒนาเว็บพอร์ทัลระบบจองห้องประชุมองค์กร (Next.js + API)',
      description:
        'ออกแบบและพัฒนาหน้าเว็บจองห้องประชุม รองรับปฏิทินแบบเรียลไทม์ ระบบสิทธิ์ผู้ใช้งาน และเชื่อมต่อ REST API พร้อมคู่มือการติดตั้ง',
      amountWei: parseEther('0.25').toString(),
      deadline: nowSeconds + 10 * day,
      workProof: 'https://github.com/digitalwork-solutions/meeting-portal-v1/commit/8a4d91f',
      state: JobState.Submitted,
    },
    {
      id: 2,
      client: SANDBOX_ADDRESSES.client,
      freelancer: SANDBOX_ADDRESSES.freelancer,
      title: 'ออกแบบระบบ Brand Identity และ UI Kit แอปพลิเคชันการเงิน',
      description:
        'ส่งมอบ Figma Design System, โลโก้หลัก, ชุดไอคอน 48 ชิ้น และหน้าจอ Prototype 15 หน้าจอสำหรับ iOS และ Android',
      amountWei: parseEther('0.15').toString(),
      deadline: nowSeconds + 14 * day,
      workProof: '',
      state: JobState.Funded,
    },
    {
      id: 3,
      client: SANDBOX_ADDRESSES.client,
      freelancer: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      title: 'พัฒนา E-Commerce Storefront และระบบตะกร้าสินค้า',
      description:
        'พัฒนาหน้าร้านค้าออนไลน์ รองรับการค้นหาสินค้า ตัวกรองหมวดหมู่ และการออกใบเสร็จอิเล็กทรอนิกส์ (เกิดความเห็นไม่ตรงกันเรื่องขอบเขตฟีเจอร์เสริม)',
      amountWei: parseEther('0.3').toString(),
      deadline: nowSeconds + 3 * day,
      workProof: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      state: JobState.Disputed,
    },
    {
      id: 4,
      client: SANDBOX_ADDRESSES.client,
      freelancer: SANDBOX_ADDRESSES.freelancer,
      title: 'ปรับปรุงประสิทธิภาพ Landing Page และ SEO โครงการ Q3',
      description:
        'ปรับแต่ง Core Web Vitals ให้คะแนน Lighthouse เกิน 95 พร้อมโครงสร้าง Schema.org และรายงานผลเปรียบเทียบก่อน-หลัง',
      amountWei: parseEther('0.12').toString(),
      deadline: nowSeconds - 2 * day,
      workProof: 'https://digitalwork.solutions/reports/seo-q3-hash-0x9e12',
      state: JobState.Completed,
    },
  ];

  const transactions: TransactionRecord[] = [
    {
      id: 'sim-tx-8',
      eventType: 'DisputeRaised',
      jobId: 3,
      actor: SANDBOX_ADDRESSES.client,
      txHash: deterministicTxHash(8, 'DisputeRaised'),
      blockNumber: 7124890,
      timestamp: nowSeconds - 3600 * 4,
      isSimulated: true,
    },
    {
      id: 'sim-tx-7',
      eventType: 'WorkSubmitted',
      jobId: 1,
      actor: SANDBOX_ADDRESSES.freelancer,
      workProof: jobs[0].workProof,
      txHash: deterministicTxHash(7, 'WorkSubmitted'),
      blockNumber: 7124812,
      timestamp: nowSeconds - 3600 * 8,
      isSimulated: true,
    },
    {
      id: 'sim-tx-6',
      eventType: 'PaymentDeposited',
      jobId: 2,
      actor: SANDBOX_ADDRESSES.client,
      amountWei: jobs[1].amountWei,
      txHash: deterministicTxHash(6, 'PaymentDeposited'),
      blockNumber: 7124650,
      timestamp: nowSeconds - day,
      isSimulated: true,
    },
    {
      id: 'sim-tx-5',
      eventType: 'JobCreated',
      jobId: 2,
      actor: SANDBOX_ADDRESSES.client,
      amountWei: jobs[1].amountWei,
      txHash: deterministicTxHash(5, 'JobCreated'),
      blockNumber: 7124640,
      timestamp: nowSeconds - day - 120,
      isSimulated: true,
    },
    {
      id: 'sim-tx-4',
      eventType: 'PaymentDeposited',
      jobId: 3,
      actor: SANDBOX_ADDRESSES.client,
      amountWei: jobs[2].amountWei,
      txHash: deterministicTxHash(4, 'PaymentDeposited'),
      blockNumber: 7124120,
      timestamp: nowSeconds - 2 * day,
      isSimulated: true,
    },
    {
      id: 'sim-tx-3',
      eventType: 'PaymentDeposited',
      jobId: 1,
      actor: SANDBOX_ADDRESSES.client,
      amountWei: jobs[0].amountWei,
      txHash: deterministicTxHash(3, 'PaymentDeposited'),
      blockNumber: 7123800,
      timestamp: nowSeconds - 3 * day,
      isSimulated: true,
    },
    {
      id: 'sim-tx-2',
      eventType: 'PaymentReleased',
      jobId: 4,
      actor: SANDBOX_ADDRESSES.freelancer,
      amountWei: jobs[3].amountWei,
      txHash: deterministicTxHash(2, 'PaymentReleased'),
      blockNumber: 7122100,
      timestamp: nowSeconds - 5 * day,
      isSimulated: true,
    },
    {
      id: 'sim-tx-1',
      eventType: 'JobCreated',
      jobId: 4,
      actor: SANDBOX_ADDRESSES.client,
      amountWei: jobs[3].amountWei,
      txHash: deterministicTxHash(1, 'JobCreated'),
      blockNumber: 7121900,
      timestamp: nowSeconds - 8 * day,
      isSimulated: true,
    },
  ];

  // Escrow locked: Job 1 (0.25) + Job 2 (0.15) + Job 3 (0.30) = 0.70 ETH
  const contractBalanceWei = parseEther('0.70').toString();

  return {
    admin: SANDBOX_ADDRESSES.admin,
    jobCount: 4,
    contractBalanceWei,
    jobs,
    transactions,
    nextBlockNumber: 7124901,
    accounts: {
      client: {
        id: 'client',
        label: 'ผู้ว่าจ้าง (Client)',
        roleTitle: 'บริษัท DigitalWork Partner',
        address: SANDBOX_ADDRESSES.client,
        balanceWei: parseEther('2.5').toString(),
      },
      freelancer: {
        id: 'freelancer',
        label: 'ฟรีแลนซ์ (Freelancer)',
        roleTitle: 'Full-Stack Developer',
        address: SANDBOX_ADDRESSES.freelancer,
        balanceWei: parseEther('0.85').toString(),
      },
      admin: {
        id: 'admin',
        label: 'ผู้ดูแลระบบ (Admin)',
        roleTitle: 'DigitalWork Arbitrator',
        address: SANDBOX_ADDRESSES.admin,
        balanceWei: parseEther('1.2').toString(),
      },
    },
  };
}

function adjustAccountBalance(
  accounts: SandboxState['accounts'],
  targetAddress: string,
  deltaWei: bigint
): SandboxState['accounts'] {
  const next = { ...accounts };
  for (const key of ['client', 'freelancer', 'admin'] as const) {
    if (next[key].address.toLowerCase() === targetAddress.toLowerCase()) {
      const current = BigInt(next[key].balanceWei);
      const updated = current + deltaWei;
      next[key] = {
        ...next[key],
        balanceWei: (updated < 0n ? 0n : updated).toString(),
      };
    }
  }
  return next;
}

export type SandboxActionResult =
  | { ok: true; state: SandboxState; txHash: string; jobId: number }
  | { ok: false; error: string };

export function createSandboxJob(
  state: SandboxState,
  callerAddress: string,
  input: CreateContractInput,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SandboxActionResult {
  const validation = validateCreateContractInput(input, callerAddress, nowSeconds);
  if (!validation.ok) return validation;

  const newJobId = state.jobCount + 1;
  const newJob: JobItem = {
    id: newJobId,
    client: callerAddress,
    freelancer: validation.data.freelancer,
    title: validation.data.title,
    description: validation.data.description,
    amountWei: validation.data.amountWei,
    deadline: validation.data.deadlineTimestamp,
    workProof: '',
    state: JobState.Created,
  };

  const txHash = deterministicTxHash(state.nextBlockNumber, `JobCreated-${newJobId}`);
  const tx: TransactionRecord = {
    id: `sim-tx-${state.transactions.length + 1}`,
    eventType: 'JobCreated',
    jobId: newJobId,
    actor: callerAddress,
    amountWei: validation.data.amountWei,
    txHash,
    blockNumber: state.nextBlockNumber,
    timestamp: nowSeconds,
    isSimulated: true,
  };

  return {
    ok: true,
    txHash,
    jobId: newJobId,
    state: {
      ...state,
      jobCount: newJobId,
      jobs: [newJob, ...state.jobs],
      transactions: [tx, ...state.transactions],
      nextBlockNumber: state.nextBlockNumber + 1,
    },
  };
}

export function depositSandboxPayment(
  state: SandboxState,
  callerAddress: string,
  jobId: number,
  depositWei: bigint,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SandboxActionResult {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job does not exist' };
  if (callerAddress.toLowerCase() !== job.client.toLowerCase()) {
    return { ok: false, error: 'Only client can perform this action' };
  }
  if (job.state !== JobState.Created) {
    return { ok: false, error: 'Invalid job state for this action' };
  }
  const agreedWei = BigInt(job.amountWei);
  if (depositWei !== agreedWei) {
    return { ok: false, error: 'Deposit amount must match the agreed wage' };
  }

  // Check sandbox wallet balance if caller matches a known sandbox account
  const matchingAccount = Object.values(state.accounts).find(
    (acc) => acc.address.toLowerCase() === callerAddress.toLowerCase()
  );
  if (matchingAccount && BigInt(matchingAccount.balanceWei) < depositWei) {
    return { ok: false, error: 'ยอด ETH ในกระเป๋าผู้ว่าจ้างไม่เพียงพอสำหรับการฝาก Escrow' };
  }

  const txHash = deterministicTxHash(state.nextBlockNumber, `PaymentDeposited-${jobId}`);
  const tx: TransactionRecord = {
    id: `sim-tx-${state.transactions.length + 1}`,
    eventType: 'PaymentDeposited',
    jobId,
    actor: callerAddress,
    amountWei: agreedWei.toString(),
    txHash,
    blockNumber: state.nextBlockNumber,
    timestamp: nowSeconds,
    isSimulated: true,
  };

  return {
    ok: true,
    txHash,
    jobId,
    state: {
      ...state,
      contractBalanceWei: (BigInt(state.contractBalanceWei) + agreedWei).toString(),
      accounts: adjustAccountBalance(state.accounts, callerAddress, -agreedWei),
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, state: JobState.Funded } : j)),
      transactions: [tx, ...state.transactions],
      nextBlockNumber: state.nextBlockNumber + 1,
    },
  };
}

export function submitSandboxWork(
  state: SandboxState,
  callerAddress: string,
  jobId: number,
  workProof: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SandboxActionResult {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job does not exist' };
  if (callerAddress.toLowerCase() !== job.freelancer.toLowerCase()) {
    return { ok: false, error: 'Only freelancer can perform this action' };
  }
  if (job.state !== JobState.Funded) {
    return { ok: false, error: 'Invalid job state for this action' };
  }
  const trimmedProof = workProof.trim();
  if (!trimmedProof) {
    return { ok: false, error: 'Work proof cannot be empty' };
  }

  const txHash = deterministicTxHash(state.nextBlockNumber, `WorkSubmitted-${jobId}`);
  const tx: TransactionRecord = {
    id: `sim-tx-${state.transactions.length + 1}`,
    eventType: 'WorkSubmitted',
    jobId,
    actor: callerAddress,
    workProof: trimmedProof,
    txHash,
    blockNumber: state.nextBlockNumber,
    timestamp: nowSeconds,
    isSimulated: true,
  };

  return {
    ok: true,
    txHash,
    jobId,
    state: {
      ...state,
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, workProof: trimmedProof, state: JobState.Submitted } : j
      ),
      transactions: [tx, ...state.transactions],
      nextBlockNumber: state.nextBlockNumber + 1,
    },
  };
}

export function approveAndReleaseSandbox(
  state: SandboxState,
  callerAddress: string,
  jobId: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SandboxActionResult {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job does not exist' };
  if (callerAddress.toLowerCase() !== job.client.toLowerCase()) {
    return { ok: false, error: 'Only client can perform this action' };
  }
  if (job.state !== JobState.Submitted) {
    return { ok: false, error: 'Invalid job state for this action' };
  }

  const amountWei = BigInt(job.amountWei);
  const currentEscrow = BigInt(state.contractBalanceWei);
  if (currentEscrow < amountWei) {
    return { ok: false, error: 'ETH transfer to freelancer failed: insufficient escrow balance' };
  }

  const txHash = deterministicTxHash(state.nextBlockNumber, `PaymentReleased-${jobId}`);
  const tx: TransactionRecord = {
    id: `sim-tx-${state.transactions.length + 1}`,
    eventType: 'PaymentReleased',
    jobId,
    actor: job.freelancer,
    amountWei: amountWei.toString(),
    txHash,
    blockNumber: state.nextBlockNumber,
    timestamp: nowSeconds,
    isSimulated: true,
  };

  return {
    ok: true,
    txHash,
    jobId,
    state: {
      ...state,
      contractBalanceWei: (currentEscrow - amountWei).toString(),
      accounts: adjustAccountBalance(state.accounts, job.freelancer, amountWei),
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, state: JobState.Completed } : j)),
      transactions: [tx, ...state.transactions],
      nextBlockNumber: state.nextBlockNumber + 1,
    },
  };
}

export function raiseSandboxDispute(
  state: SandboxState,
  callerAddress: string,
  jobId: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SandboxActionResult {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job does not exist' };
  const isParty =
    callerAddress.toLowerCase() === job.client.toLowerCase() ||
    callerAddress.toLowerCase() === job.freelancer.toLowerCase();
  if (!isParty) {
    return { ok: false, error: 'Only client or freelancer can raise dispute' };
  }
  if (job.state !== JobState.Funded && job.state !== JobState.Submitted) {
    return { ok: false, error: 'Cannot dispute at current state' };
  }

  const txHash = deterministicTxHash(state.nextBlockNumber, `DisputeRaised-${jobId}`);
  const tx: TransactionRecord = {
    id: `sim-tx-${state.transactions.length + 1}`,
    eventType: 'DisputeRaised',
    jobId,
    actor: callerAddress,
    txHash,
    blockNumber: state.nextBlockNumber,
    timestamp: nowSeconds,
    isSimulated: true,
  };

  return {
    ok: true,
    txHash,
    jobId,
    state: {
      ...state,
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, state: JobState.Disputed } : j)),
      transactions: [tx, ...state.transactions],
      nextBlockNumber: state.nextBlockNumber + 1,
    },
  };
}

export function resolveSandboxDispute(
  state: SandboxState,
  callerAddress: string,
  jobId: number,
  releaseToFreelancer: boolean,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SandboxActionResult {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Job does not exist' };
  if (callerAddress.toLowerCase() !== state.admin.toLowerCase()) {
    return { ok: false, error: 'Only admin can perform this action' };
  }
  if (job.state !== JobState.Disputed) {
    return { ok: false, error: 'Invalid job state for this action' };
  }

  const amountWei = BigInt(job.amountWei);
  const currentEscrow = BigInt(state.contractBalanceWei);
  if (currentEscrow < amountWei) {
    return { ok: false, error: 'Insufficient escrow balance' };
  }

  const recipient = releaseToFreelancer ? job.freelancer : job.client;
  const nextJobState = releaseToFreelancer ? JobState.Completed : JobState.Refunded;
  const txHash = deterministicTxHash(state.nextBlockNumber, `DisputeResolved-${jobId}`);
  const tx: TransactionRecord = {
    id: `sim-tx-${state.transactions.length + 1}`,
    eventType: 'DisputeResolved',
    jobId,
    actor: callerAddress,
    paidToFreelancer: releaseToFreelancer,
    amountWei: amountWei.toString(),
    txHash,
    blockNumber: state.nextBlockNumber,
    timestamp: nowSeconds,
    isSimulated: true,
  };

  return {
    ok: true,
    txHash,
    jobId,
    state: {
      ...state,
      contractBalanceWei: (currentEscrow - amountWei).toString(),
      accounts: adjustAccountBalance(state.accounts, recipient, amountWei),
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, state: nextJobState } : j)),
      transactions: [tx, ...state.transactions],
      nextBlockNumber: state.nextBlockNumber + 1,
    },
  };
}
