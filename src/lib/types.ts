export enum JobState {
  Created = 0,
  Funded = 1,
  Submitted = 2,
  Disputed = 3,
  Completed = 4,
  Refunded = 5,
}

export type ExecutionMode = 'sepolia' | 'sandbox';

export type ActorRole = 'client' | 'freelancer' | 'admin' | 'viewer';

export type TransactionEventType =
  | 'JobCreated'
  | 'PaymentDeposited'
  | 'WorkSubmitted'
  | 'PaymentReleased'
  | 'DisputeRaised'
  | 'DisputeResolved';

export interface JobItem {
  id: number;
  client: string;
  freelancer: string;
  title: string;
  description: string;
  amountWei: string;
  deadline: number; // Unix timestamp in seconds
  workProof: string;
  state: JobState;
}

export interface TransactionRecord {
  id: string;
  eventType: TransactionEventType;
  jobId: number;
  actor: string;
  amountWei?: string;
  workProof?: string;
  paidToFreelancer?: boolean;
  txHash: string;
  blockNumber: number;
  timestamp: number; // Unix timestamp in seconds
  isSimulated?: boolean;
}

export interface CreateContractInput {
  title: string;
  description: string;
  amountEth: string;
  deadlineIso: string; // YYYY-MM-DDTHH:mm or ISO string
  freelancerAddress: string;
}

export interface EscrowMetrics {
  totalJobs: number;
  escrowLockedWei: bigint;
  completedPayoutsWei: bigint;
  activeDisputes: number;
}

export interface SandboxAccount {
  id: 'client' | 'freelancer' | 'admin';
  label: string;
  roleTitle: string;
  address: string;
  balanceWei: string;
}

export interface SandboxState {
  admin: string;
  jobCount: number;
  contractBalanceWei: string;
  jobs: JobItem[];
  transactions: TransactionRecord[];
  accounts: Record<'client' | 'freelancer' | 'admin', SandboxAccount>;
  nextBlockNumber: number;
}
