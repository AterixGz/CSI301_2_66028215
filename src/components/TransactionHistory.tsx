import { Check, Copy, ExternalLink, History, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  EVENT_LABEL_MAP,
  formatEthFromWei,
  formatThaiDateTime,
  getEtherscanTxUrl,
  shortenAddress,
} from '../lib/contract';
import { ExecutionMode, TransactionEventType, TransactionRecord } from '../lib/types';

interface TransactionHistoryProps {
  transactions: TransactionRecord[];
  isLoading: boolean;
  mode: ExecutionMode;
}

const EVENT_FILTERS: Array<{ value: 'all' | TransactionEventType; label: string }> = [
  { value: 'all', label: 'ทุก Event' },
  { value: 'JobCreated', label: 'JobCreated' },
  { value: 'PaymentDeposited', label: 'PaymentDeposited' },
  { value: 'WorkSubmitted', label: 'WorkSubmitted' },
  { value: 'PaymentReleased', label: 'PaymentReleased' },
  { value: 'DisputeRaised', label: 'DisputeRaised' },
  { value: 'DisputeResolved', label: 'DisputeResolved' },
];

export function TransactionHistory({
  transactions,
  isLoading,
  mode,
}: TransactionHistoryProps) {
  const [eventFilter, setEventFilter] = useState<'all' | TransactionEventType>('all');
  const [query, setQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (eventFilter !== 'all' && tx.eventType !== eventFilter) return false;
      if (!q) return true;
      return (
        tx.txHash.toLowerCase().includes(q) ||
        tx.actor.toLowerCase().includes(q) ||
        String(tx.jobId) === q ||
        `#${tx.jobId}` === q
      );
    });
  }, [transactions, eventFilter, query]);

  const handleCopyHash = async (txHash: string) => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedHash(txHash);
      setTimeout(() => setCopiedHash(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <section aria-label="ประวัติธุรกรรม Smart Contract" className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              ติดตามสถานะธุรกรรม (Transaction Tracking)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              บันทึก Event จาก Smart Contract พร้อม Block Number และ Transaction Hash สำหรับตรวจสอบย้อนหลัง
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="tx-search-input" className="sr-only">
              ค้นหา Transaction Hash, Job ID หรือ Address
            </label>
            <input
              id="tx-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา Tx Hash, Job ID, 0x..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="กรองตามประเภท Event">
          {EVENT_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={eventFilter === f.value}
              onClick={() => setEventFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                eventFilter === f.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="divide-y divide-slate-100" aria-busy="true">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between px-5 py-4 animate-pulse">
              <div className="h-4 w-56 rounded bg-slate-200" />
              <div className="h-4 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <History className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <h3 className="mt-3 font-display text-sm font-semibold text-slate-900">
            ยังไม่มีบันทึกธุรกรรม
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            เมื่อมีการสร้างข้อตกลง ฝากเงิน ส่งมอบงาน หรือตัดสินข้อพิพาท Transaction Hash จะปรากฏที่นี่
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 whitespace-nowrap">ประเภทธุรกรรม (Event)</th>
                <th className="py-3 px-3 whitespace-nowrap">สัญญา</th>
                <th className="py-3 px-3 whitespace-nowrap">ผู้ทำรายการ</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">จำนวน (ETH)</th>
                <th className="py-3 px-3 whitespace-nowrap">เวลา / Block</th>
                <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Transaction Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 pl-5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                    <div>{EVENT_LABEL_MAP[tx.eventType]}</div>
                    {tx.eventType === 'DisputeResolved' && tx.paidToFreelancer !== undefined && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {tx.paidToFreelancer ? 'ตัดสินจ่ายให้ฟรีแลนซ์' : 'ตัดสินคืนเงินผู้ว่าจ้าง'}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    #{tx.jobId}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {shortenAddress(tx.actor)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {tx.amountWei ? `${formatEthFromWei(tx.amountWei)} ETH` : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap tabular-nums">
                    <div>{formatThaiDateTime(tx.timestamp)}</div>
                    <div className="font-mono text-[11px] text-slate-400">Block {tx.blockNumber}</div>
                  </td>
                  <td className="py-3.5 pl-3 pr-5 text-right font-mono whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {mode === 'sepolia' && !tx.isSimulated ? (
                        <a
                          href={getEtherscanTxUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <span>{shortenAddress(tx.txHash, 8, 6)}</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-slate-700">
                          {shortenAddress(tx.txHash, 8, 6)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyHash(tx.txHash)}
                        aria-label={`คัดลอก Transaction Hash ${tx.txHash}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        {copiedHash === tx.txHash ? (
                          <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
