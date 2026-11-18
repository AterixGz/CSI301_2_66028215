import { Check, Copy, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import {
  CONTRACT_ADDRESS,
  JOB_STATE_META,
  SEPOLIA_CHAIN_ID,
  formatEthFromWei,
  formatThaiDateTime,
  getEtherscanAddressUrl,
  parseContractError,
  shortenAddress,
} from '../lib/contract';
import { fetchSingleSepoliaJob } from '../lib/sepoliaService';
import { JobItem } from '../lib/types';

interface ContractInspectorProps {
  adminAddress: string;
  jobCount: number;
  contractBalanceWei: string;
  latestBlock: number | null;
  rpcUrl: string | null;
}

export function ContractInspector({
  adminAddress,
  jobCount,
  contractBalanceWei,
  latestBlock,
  rpcUrl,
}: ContractInspectorProps) {
  const [lookupId, setLookupId] = useState('1');
  const [lookupResult, setLookupResult] = useState<JobItem | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleLookupJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    const num = Number(lookupId);
    if (!Number.isInteger(num) || num <= 0) {
      setLookupError('กรุณาระบุ Job ID เป็นตัวเลขจำนวนเต็มบวก (ตั้งแต่ 1 ขึ้นไป)');
      return;
    }

    setIsLookingUp(true);
    try {
      const job = await fetchSingleSepoliaJob(num);
      setLookupResult(job);
    } catch (err) {
      setLookupError(parseContractError(err));
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contract Specification Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                ข้อมูล Smart Contract บน Ethereum Sepolia
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                สัญญา FreelanceEscrow ที่ Deploy ใช้งานจริงสำหรับ DigitalWork Solutions
              </p>
            </div>
            <a
              href={getEtherscanAddressUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <span>Etherscan</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          <dl className="divide-y divide-slate-100 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt className="text-slate-500">Contract Address</dt>
              <dd className="flex items-center gap-1.5 font-mono text-slate-900">
                <span className="break-all">{CONTRACT_ADDRESS}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="คัดลอก Contract Address"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2 py-3">
              <dt className="text-slate-500">เครือข่าย (Network)</dt>
              <dd className="font-mono font-medium text-slate-900 tabular-nums">
                Ethereum Sepolia (Chain ID: {SEPOLIA_CHAIN_ID})
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2 py-3">
              <dt className="text-slate-500">ผู้ดูแลระบบ (Admin / Arbitrator)</dt>
              <dd>
                <a
                  href={getEtherscanAddressUrl(adminAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
                >
                  <span>{shortenAddress(adminAddress, 8, 6)}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2 py-3">
              <dt className="text-slate-500">ยอดเงินที่ถือครองใน Escrow (Contract Balance)</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatEthFromWei(contractBalanceWei)} ETH
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2 py-3">
              <dt className="text-slate-500">จำนวนสัญญาบนเชน (jobCount)</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {jobCount}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2 py-3">
              <dt className="text-slate-500">Sepolia RPC &amp; Block ล่าสุด</dt>
              <dd className="font-mono text-slate-700 tabular-nums">
                {latestBlock ? `Block #${latestBlock}` : '—'}
                {rpcUrl ? ` · ${new URL(rpcUrl).hostname}` : ''}
              </dd>
            </div>
          </dl>
        </section>

        {/* Business Rules & Security Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              กฎทางธุรกิจและกลไกความปลอดภัยของสัญญา
            </h2>
          </div>

          <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="font-semibold text-slate-900">01. ห้ามจ่ายเงินซ้ำ (Anti-Double Payment):</span>{' '}
              ฟังก์ชัน <span className="font-mono text-slate-800">approveAndRelease</span> ปรับสถานะเป็น{' '}
              <span className="font-mono text-slate-800">Completed</span> ก่อนคำสั่งโอน ETH เสมอ (Checks-Effects-Interactions)
            </li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="font-semibold text-slate-900">02. ล็อกเงินใน Escrow จนกว่าจะเข้าเงื่อนไข:</span>{' '}
              ไม่มีคำสั่งถอนเงินโดยพลการ เงินจะถูกโอนได้เฉพาะเมื่อผู้ว่าจ้างกดอนุมัติรับงาน หรือเมื่อผู้ดูแลระบบ (Admin) ตัดสินข้อพิพาทเท่านั้น
            </li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="font-semibold text-slate-900">03. ตรวจสอบสิทธิ์คู่สัญญาทุกขั้นตอน:</span>{' '}
              แยกสิทธิ์ชัดเจนด้วย <span className="font-mono text-slate-800">onlyClient</span>,{' '}
              <span className="font-mono text-slate-800">onlyFreelancer</span> และ{' '}
              <span className="font-mono text-slate-800">onlyAdmin</span>
            </li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="font-semibold text-slate-900">04. ฝากเงินตรงตามข้อตกลง 100%:</span>{' '}
              บังคับ <span className="font-mono text-slate-800">msg.value == job.amount</span> ในขั้นตอน{' '}
              <span className="font-mono text-slate-800">depositPayment</span> เพื่อป้องกันการโอนเงินขาดหรือเกิน
            </li>
          </ul>
        </section>
      </div>

      {/* Direct On-Chain getJob(id) Lookup */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            ตรวจสอบข้อมูลสัญญาโดยตรงจาก Sepolia (getJob)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            เรียกอ่านฟังก์ชัน view <span className="font-mono">getJob(uint256 _jobId)</span> จากสัญญาจริงบนเครือข่าย Sepolia
          </p>
        </div>

        <form onSubmit={handleLookupJob} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="getjob-id-input" className="sr-only">
            รหัสสัญญา Job ID
          </label>
          <input
            id="getjob-id-input"
            type="number"
            min={1}
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="ระบุ Job ID เช่น 1"
            className="w-full sm:w-56 rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLookingUp}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isLookingUp ? 'กำลังอ่านข้อมูลจาก Sepolia...' : 'อ่านข้อมูลจากเชน'}</span>
          </button>
        </form>

        {lookupError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {lookupError}
          </div>
        )}

        {lookupResult && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-semibold text-slate-900">
                Job #{lookupResult.id} · {lookupResult.title}
              </span>
              <span className={`font-medium ${JOB_STATE_META[lookupResult.state].textClass}`}>
                {JOB_STATE_META[lookupResult.state].labelTh}
              </span>
            </div>
            <p className="text-slate-600">{lookupResult.description}</p>
            <div className="grid grid-cols-1 gap-2 pt-2 font-mono text-slate-700 sm:grid-cols-3">
              <div>Client: {shortenAddress(lookupResult.client)}</div>
              <div>Freelancer: {shortenAddress(lookupResult.freelancer)}</div>
              <div>
                Amount: {formatEthFromWei(lookupResult.amountWei)} ETH · Due:{' '}
                {formatThaiDateTime(lookupResult.deadline)}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
