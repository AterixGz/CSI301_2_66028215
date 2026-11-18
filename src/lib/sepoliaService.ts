import { BrowserProvider, Contract, JsonRpcProvider, parseEther } from 'ethers';
import {
  CONTRACT_ADDRESS,
  FREELANCE_ESCROW_ABI,
  SEPOLIA_CHAIN_HEX,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_RPC_URLS,
} from './contract';
import {
  CreateContractInput,
  JobItem,
  JobState,
  TransactionEventType,
  TransactionRecord,
} from './types';

export interface SepoliaSnapshot {
  rpcUrl: string;
  admin: string;
  jobCount: number;
  contractBalanceWei: string;
  jobs: JobItem[];
  transactions: TransactionRecord[];
  latestBlock: number;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  balanceWei: string;
}

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

function getInjectedEthereum(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { ethereum?: Eip1193Provider };
  return win.ethereum ?? null;
}

export function hasInjectedWallet(): boolean {
  return getInjectedEthereum() !== null;
}

async function getWorkingSepoliaProvider(): Promise<{ provider: JsonRpcProvider; rpcUrl: string }> {
  let lastError: unknown;
  for (const rpcUrl of SEPOLIA_RPC_URLS) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, SEPOLIA_CHAIN_ID, {
        staticNetwork: true,
      });
      await provider.getBlockNumber();
      return { provider, rpcUrl };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('ไม่สามารถเชื่อมต่อ Ethereum Sepolia RPC ได้ในขณะนี้');
}

export async function fetchSepoliaContractSnapshot(): Promise<SepoliaSnapshot> {
  const { provider, rpcUrl } = await getWorkingSepoliaProvider();
  const contract = new Contract(CONTRACT_ADDRESS, FREELANCE_ESCROW_ABI, provider);

  const [admin, rawJobCount, contractBalance, latestBlock] = await Promise.all([
    contract.admin() as Promise<string>,
    contract.jobCount() as Promise<bigint>,
    provider.getBalance(CONTRACT_ADDRESS),
    provider.getBlockNumber(),
  ]);

  const jobCount = Number(rawJobCount);
  const jobs: JobItem[] = [];

  // Read all jobs from 1..jobCount (newest first)
  if (jobCount > 0) {
    const jobIds = Array.from({ length: jobCount }, (_, idx) => jobCount - idx);
    const jobResults = await Promise.all(
      jobIds.map((id) => contract.getJob(id))
    );
    for (const raw of jobResults) {
      jobs.push({
        id: Number(raw.id),
        client: raw.client,
        freelancer: raw.freelancer,
        title: raw.title,
        description: raw.description,
        amountWei: raw.amount.toString(),
        deadline: Number(raw.deadline),
        workProof: raw.workProof,
        state: Number(raw.state) as JobState,
      });
    }
  }

  // Fetch recent event logs (last 45,000 blocks to stay within public RPC query limits)
  const transactions: TransactionRecord[] = [];
  const fromBlock = Math.max(0, latestBlock - 45000);
  try {
    const logs = await contract.queryFilter('*', fromBlock, latestBlock);
    const blockTimestamps = new Map<number, number>();
    const uniqueBlocks = Array.from(new Set(logs.map((l) => l.blockNumber))).slice(0, 30);

    await Promise.all(
      uniqueBlocks.map(async (bn) => {
        try {
          const blk = await provider.getBlock(bn);
          if (blk) blockTimestamps.set(bn, Number(blk.timestamp));
        } catch {
          // Ignore single block lookup errors
        }
      })
    );

    for (const log of logs) {
      if (!('fragment' in log) || !log.fragment) continue;
      const eventName = log.fragment.name as TransactionEventType;
      const args = log.args;
      const jobId = Number(args[0] ?? 0);
      const actor = String(args[1] ?? '');

      let amountWei: string | undefined;
      let workProof: string | undefined;
      let paidToFreelancer: boolean | undefined;

      if (eventName === 'JobCreated') {
        amountWei = args[4]?.toString();
      } else if (eventName === 'PaymentDeposited' || eventName === 'PaymentReleased') {
        amountWei = args[2]?.toString();
      } else if (eventName === 'WorkSubmitted') {
        workProof = String(args[2] ?? '');
      } else if (eventName === 'DisputeResolved') {
        paidToFreelancer = Boolean(args[2]);
        amountWei = args[3]?.toString();
      }

      transactions.push({
        id: `${log.transactionHash}-${log.index}`,
        eventType: eventName,
        jobId,
        actor,
        amountWei,
        workProof,
        paidToFreelancer,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: blockTimestamps.get(log.blockNumber) ?? Math.floor(Date.now() / 1000),
        isSimulated: false,
      });
    }

    transactions.sort((a, b) => b.blockNumber - a.blockNumber);
  } catch {
    // Public RPCs occasionally restrict wide log scans; return jobs cleanly without blocking
  }

  return {
    rpcUrl,
    admin,
    jobCount,
    contractBalanceWei: contractBalance.toString(),
    jobs,
    transactions,
    latestBlock,
  };
}

export async function fetchSingleSepoliaJob(jobId: number): Promise<JobItem> {
  const { provider } = await getWorkingSepoliaProvider();
  const contract = new Contract(CONTRACT_ADDRESS, FREELANCE_ESCROW_ABI, provider);
  const raw = await contract.getJob(jobId);
  return {
    id: Number(raw.id),
    client: raw.client,
    freelancer: raw.freelancer,
    title: raw.title,
    description: raw.description,
    amountWei: raw.amount.toString(),
    deadline: Number(raw.deadline),
    workProof: raw.workProof,
    state: Number(raw.state) as JobState,
  };
}

export async function connectInjectedWallet(): Promise<WalletConnection> {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error('ไม่พบ Web3 Wallet (เช่น MetaMask) ในเบราว์เซอร์ของคุณ');
  }

  const browserProvider = new BrowserProvider(ethereum as never);
  await browserProvider.send('eth_requestAccounts', []);
  const signer = await browserProvider.getSigner();
  const address = await signer.getAddress();
  const network = await browserProvider.getNetwork();
  const balance = await browserProvider.getBalance(address);

  return {
    address,
    chainId: Number(network.chainId),
    balanceWei: balance.toString(),
  };
}

export async function readConnectedWalletState(): Promise<WalletConnection | null> {
  const ethereum = getInjectedEthereum();
  if (!ethereum) return null;
  const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
  if (!accounts || accounts.length === 0) return null;

  const browserProvider = new BrowserProvider(ethereum as never);
  const address = accounts[0];
  const [network, balance] = await Promise.all([
    browserProvider.getNetwork(),
    browserProvider.getBalance(address),
  ]);
  return {
    address,
    chainId: Number(network.chainId),
    balanceWei: balance.toString(),
  };
}

export async function switchToSepoliaNetwork(): Promise<void> {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error('ไม่พบ MetaMask หรือ Web3 Wallet');
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: SEPOLIA_CHAIN_HEX,
            chainName: 'Ethereum Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [SEPOLIA_RPC_URLS[0]],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

async function getSepoliaSignerContract(): Promise<Contract> {
  const ethereum = getInjectedEthereum();
  if (!ethereum) {
    throw new Error('กรุณาเชื่อมต่อ MetaMask ก่อนทำธุรกรรมบน Sepolia');
  }
  const browserProvider = new BrowserProvider(ethereum as never);
  const network = await browserProvider.getNetwork();
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
    await switchToSepoliaNetwork();
  }
  const refreshedProvider = new BrowserProvider(ethereum as never);
  const signer = await refreshedProvider.getSigner();
  return new Contract(CONTRACT_ADDRESS, FREELANCE_ESCROW_ABI, signer);
}

export async function sendCreateContract(input: CreateContractInput): Promise<string> {
  const contract = await getSepoliaSignerContract();
  const amountWei = parseEther(input.amountEth.trim());
  const deadlineTimestamp = Math.floor(Date.parse(input.deadlineIso) / 1000);
  const tx = await contract.createContract(
    input.title.trim(),
    input.description.trim(),
    amountWei,
    deadlineTimestamp,
    input.freelancerAddress.trim()
  );
  await tx.wait();
  return tx.hash;
}

export async function sendDepositPayment(jobId: number, amountWei: string): Promise<string> {
  const contract = await getSepoliaSignerContract();
  const tx = await contract.depositPayment(jobId, { value: BigInt(amountWei) });
  await tx.wait();
  return tx.hash;
}

export async function sendSubmitWork(jobId: number, workProof: string): Promise<string> {
  const contract = await getSepoliaSignerContract();
  const tx = await contract.submitWork(jobId, workProof.trim());
  await tx.wait();
  return tx.hash;
}

export async function sendApproveAndRelease(jobId: number): Promise<string> {
  const contract = await getSepoliaSignerContract();
  const tx = await contract.approveAndRelease(jobId);
  await tx.wait();
  return tx.hash;
}

export async function sendRaiseDispute(jobId: number): Promise<string> {
  const contract = await getSepoliaSignerContract();
  const tx = await contract.raiseDispute(jobId);
  await tx.wait();
  return tx.hash;
}

export async function sendResolveDispute(
  jobId: number,
  releaseToFreelancer: boolean
): Promise<string> {
  const contract = await getSepoliaSignerContract();
  const tx = await contract.resolveDispute(jobId, releaseToFreelancer);
  await tx.wait();
  return tx.hash;
}
