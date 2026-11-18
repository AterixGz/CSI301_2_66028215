import { formatEthFromWei } from '../lib/contract';
import { EscrowMetrics } from '../lib/types';

interface MetricsStripProps {
  metrics: EscrowMetrics;
  isLoading?: boolean;
}

export function MetricsStrip({ metrics, isLoading = false }: MetricsStripProps) {
  const items = [
    {
      label: 'สัญญาจ้างทั้งหมด',
      value: isLoading ? '—' : `${metrics.totalJobs}`,
      unit: 'โครงการ',
      note: 'จำนวนสัญญาที่สร้างในระบบ',
    },
    {
      label: 'เงินค้ำประกันใน Escrow',
      value: isLoading ? '—' : formatEthFromWei(metrics.escrowLockedWei),
      unit: 'ETH',
      note: 'ถูกล็อกจนกว่าจะอนุมัติหรือตัดสินข้อพิพาท',
    },
    {
      label: 'ยอดจ่ายให้ฟรีแลนซ์แล้ว',
      value: isLoading ? '—' : formatEthFromWei(metrics.completedPayoutsWei),
      unit: 'ETH',
      note: 'โอนอัตโนมัติหลังตรวจรับงานสำเร็จ',
    },
    {
      label: 'ข้อพิพาทที่รอพิจารณา',
      value: isLoading ? '—' : `${metrics.activeDisputes}`,
      unit: 'รายการ',
      note: metrics.activeDisputes > 0 ? 'รอ Admin พิจารณาตัดสิน' : 'ไม่มีข้อพิพาทค้างอยู่',
      highlightDanger: !isLoading && metrics.activeDisputes > 0,
    },
  ];

  return (
    <section aria-label="ตัวชี้วัดภาพรวม Escrow" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-200 bg-white px-5 py-4"
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${
                item.highlightDanger ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {item.value}
            </span>
            <span className="text-xs font-medium text-slate-500">{item.unit}</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{item.note}</p>
        </div>
      ))}
    </section>
  );
}
