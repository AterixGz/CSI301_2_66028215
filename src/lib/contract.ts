import { formatEther, isAddress, parseEther } from 'ethers';
import { JobState, TransactionEventType } from './types';

export const CONTRACT_ADDRESS = '0xA9150693a16Bd2A38eB14b57510D031b2395dAA0';
export const DEFAULT_DEPLOYED_ADMIN = '0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C';
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = '0xaa36a7';
export const ETHERSCAN_BASE_URL = 'https://sepolia.etherscan.io';

export const SEPOLIA_RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://1rpc.io/sepolia',
  'https://sepolia.drpc.org',
  'https://rpc.sepolia.org',
];

export const FREELANCE_ESCROW_ABI = [
  'function admin() view returns (address)',
  'function jobCount() view returns (uint256)',
  'function jobs(uint256) view returns (uint256 id, address client, address freelancer, string title, string description, uint256 amount, uint256 deadline, string workProof, uint8 state)',
  'function getJob(uint256 _jobId) view returns (tuple(uint256 id, address client, address freelancer, string title, string description, uint256 amount, uint256 deadline, string workProof, uint8 state))',
  'function createContract(string _title, string _description, uint256 _amountInWei, uint256 _deadlineTimestamp, address _freelancer) returns (uint256)',
  'function depositPayment(uint256 _jobId) payable',
  'function submitWork(uint256 _jobId, string _workProof)',
  'function approveAndRelease(uint256 _jobId)',
  'function raiseDispute(uint256 _jobId)',
  'function resolveDispute(uint256 _jobId, bool _releaseToFreelancer)',
  'event JobCreated(uint256 indexed jobId, address indexed client, address indexed freelancer, string title, uint256 amount, uint256 deadline)',
  'event PaymentDeposited(uint256 indexed jobId, address indexed client, uint256 amount)',
  'event WorkSubmitted(uint256 indexed jobId, address indexed freelancer, string workProof)',
  'event PaymentReleased(uint256 indexed jobId, address indexed freelancer, uint256 amount)',
  'event DisputeRaised(uint256 indexed jobId, address indexed raisedBy)',
  'event DisputeResolved(uint256 indexed jobId, address indexed resolvedBy, bool paidToFreelancer, uint256 amount)',
] as const;

export interface JobStateMeta {
  state: JobState;
  labelTh: string;
  labelEn: string;
  description: string;
  textClass: string;
  accentBgClass: string;
  borderClass: string;
}

export const JOB_STATE_META: Record<JobState, JobStateMeta> = {
  [JobState.Created]: {
    state: JobState.Created,
    labelTh: 'สร้างข้อตกลงแล้ว',
    labelEn: 'Created',
    description: 'รอผู้ว่าจ้างโอน ETH เข้าสู่ Smart Contract Escrow',
    textClass: 'text-slate-700',
    accentBgClass: 'bg-slate-100',
    borderClass: 'border-slate-300',
  },
  [JobState.Funded]: {
    state: JobState.Funded,
    labelTh: 'ฝากเงินเข้า Escrow แล้ว',
    labelEn: 'Funded',
    description: 'เงินค่าจ้างถูกล็อกในสัญญาแล้ว รอฟรีแลนซ์ส่งมอบงาน',
    textClass: 'text-amber-700',
    accentBgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  [JobState.Submitted]: {
    state: JobState.Submitted,
    labelTh: 'ส่งมอบงานแล้ว',
    labelEn: 'Submitted',
    description: 'ฟรีแลนซ์ส่งหลักฐานงานแล้ว รอผู้ว่าจ้างตรวจสอบและอนุมัติจ่ายเงิน',
    textClass: 'text-blue-700',
    accentBgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  [JobState.Disputed]: {
    state: JobState.Disputed,
    labelTh: 'เกิดข้อพิพาท',
    labelEn: 'Disputed',
    description: 'ระงับการจ่ายเงินชั่วคราว รอผู้ดูแลระบบ (Admin) ตัดสิน',
    textClass: 'text-red-700',
    accentBgClass: 'bg-red-50',
    borderClass: 'border-red-200',
  },
  [JobState.Completed]: {
    state: JobState.Completed,
    labelTh: 'เสร็จสมบูรณ์',
    labelEn: 'Completed',
    description: 'อนุมัติรับงานและโอนค่าจ้างให้ฟรีแลนซ์เรียบร้อยแล้ว',
    textClass: 'text-emerald-700',
    accentBgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  [JobState.Refunded]: {
    state: JobState.Refunded,
    labelTh: 'คืนเงินผู้ว่าจ้างแล้ว',
    labelEn: 'Refunded',
    description: 'Admin ตัดสินคืนเงินค่าจ้างกลับไปยังผู้ว่าจ้างแล้ว',
    textClass: 'text-slate-700',
    accentBgClass: 'bg-slate-100',
    borderClass: 'border-slate-300',
  },
};

export const EVENT_LABEL_MAP: Record<TransactionEventType, string> = {
  JobCreated: 'สร้างข้อตกลง (JobCreated)',
  PaymentDeposited: 'ฝากเงิน Escrow (PaymentDeposited)',
  WorkSubmitted: 'ส่งมอบงาน (WorkSubmitted)',
  PaymentReleased: 'อนุมัติและจ่ายเงิน (PaymentReleased)',
  DisputeRaised: 'แจ้งข้อพิพาท (DisputeRaised)',
  DisputeResolved: 'ตัดสินข้อพิพาท (DisputeResolved)',
};

export function shortenAddress(address: string, head = 6, tail = 4): string {
  if (!address) return '-';
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatEthFromWei(weiStr: string | bigint, maxDecimals = 4): string {
  try {
    const val = typeof weiStr === 'bigint' ? weiStr : BigInt(weiStr || '0');
    const ethStr = formatEther(val);
    const num = Number(ethStr);
    if (Number.isNaN(num)) return '0';
    if (num === 0) return '0';
    // Preserve exact precision up to maxDecimals without trailing unnecessary zeros
    return Number(num.toFixed(maxDecimals)).toString();
  } catch {
    return '0';
  }
}

export function safeParseEther(ethAmount: string): bigint | null {
  try {
    const trimmed = ethAmount.trim();
    if (!trimmed) return null;
    const wei = parseEther(trimmed);
    return wei;
  } catch {
    return null;
  }
}

export function isValidEthAddress(addr: string): boolean {
  return isAddress(addr.trim());
}

export function formatThaiDateTime(unixSeconds: number): string {
  if (!unixSeconds) return '-';
  try {
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return new Date(unixSeconds * 1000).toISOString();
  }
}

export function getEtherscanAddressUrl(address: string): string {
  return `${ETHERSCAN_BASE_URL}/address/${address}`;
}

export function getEtherscanTxUrl(txHash: string): string {
  return `${ETHERSCAN_BASE_URL}/tx/${txHash}`;
}

export function parseContractError(err: unknown): string {
  if (!err) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  const msg =
    typeof err === 'string'
      ? err
      : (err as { shortMessage?: string; reason?: string; message?: string }).reason ||
        (err as { shortMessage?: string }).shortMessage ||
        (err as { message?: string }).message ||
        String(err);

  if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
    return 'คุณยกเลิกการยืนยันธุรกรรมในกระเป๋า Wallet';
  }
  if (msg.includes('Only admin can perform this action')) {
    return 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถตัดสินข้อพิพาทได้';
  }
  if (msg.includes('Only client can perform this action')) {
    return 'เฉพาะผู้ว่าจ้าง (Client) ของสัญญานี้เท่านั้นที่ดำเนินการได้';
  }
  if (msg.includes('Only freelancer can perform this action')) {
    return 'เฉพาะฟรีแลนซ์ (Freelancer) ของสัญญานี้เท่านั้นที่ดำเนินการได้';
  }
  if (msg.includes('Invalid job state for this action')) {
    return 'สถานะของงานไม่อยู่ในขั้นตอนที่ทำรายการนี้ได้ (ป้องกันการทำรายการซ้ำ)';
  }
  if (msg.includes('Deposit amount must match the agreed wage')) {
    return 'จำนวน ETH ที่ฝากต้องตรงกับค่าจ้างที่ตกลงไว้ในสัญญาเท่านั้น';
  }
  if (msg.includes('Client and freelancer cannot be the same')) {
    return 'ผู้ว่าจ้างและฟรีแลนซ์ต้องไม่ใช่ Wallet Address เดียวกัน';
  }
  if (msg.includes('Deadline must be in the future')) {
    return 'กำหนดส่งมอบงานต้องเป็นเวลาในอนาคต';
  }
  if (msg.includes('insufficient funds')) {
    return 'ยอด Sepolia ETH ในกระเป๋าไม่เพียงพอสำหรับค่าจ้างและค่า Gas';
  }
  return msg;
}
