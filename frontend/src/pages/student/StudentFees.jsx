import { useState } from "react";
import { Receipt, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { AsyncBlock, Badge, Button, Card, DataTable, PageHeader, PageSkeleton, StatCard } from "../../components/ui";
import { ReceiptModal } from "../../features/fees/FeeComponents";
import { fmtDate, fmtDateTime, fmtMoney, titleCase } from "../../utils/format";

export default function StudentFees() {
  const { data, loading, error, refetch } = useApi("/fees/me");
  const [receipt, setReceipt] = useState(null);
  if (loading && !data) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Fees" subtitle="Fee structure, dues and payment history" />
      <AsyncBlock error={error} onRetry={refetch}>
        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total fees" value={fmtMoney(data.summary.total)} icon={Wallet} />
              <StatCard label="Paid" value={fmtMoney(data.summary.paid)} icon={CheckCircle2} tone="green" />
              <StatCard label="Pending" value={fmtMoney(data.summary.pending)} icon={AlertTriangle} tone={data.summary.pending ? "amber" : "green"} />
              <StatCard label="Late fine" value={fmtMoney(data.summary.fine)} icon={AlertTriangle} tone={data.summary.fine ? "red" : "slate"} />
            </div>
            {data.records.map((r) => (
              <Card key={r.fee._id} title={r.fee.name} subtitle={`${r.fee.semester?.name || ""} · Due ${fmtDate(r.dueDate)}${r.fee.finePerDay ? ` · Late fine ${fmtMoney(r.fee.finePerDay)}/day` : ""}`} actions={<Badge status={r.status} />}>
                <div className="grid gap-6 md:grid-cols-2">
                  <table className="w-full text-sm">
                    <tbody>
                      {r.fee.components.map((c) => (
                        <tr key={c.name} className="border-b border-slate-100"><td className="py-2 text-slate-600">{c.name}</td><td className="py-2 text-right">{fmtMoney(c.amount)}</td></tr>
                      ))}
                      <tr><td className="py-2 font-semibold">Total</td><td className="py-2 text-right font-semibold">{fmtMoney(r.totalAmount)}</td></tr>
                    </tbody>
                  </table>
                  <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="flex justify-between"><span>Paid</span><b className="text-emerald-700">{fmtMoney(r.paid)}</b></p>
                    <p className="flex justify-between"><span>Pending</span><b className={r.pending ? "text-amber-700" : ""}>{fmtMoney(r.pending)}</b></p>
                    {r.fine > 0 && <p className="flex justify-between"><span>Late fine</span><b className="text-rose-600">{fmtMoney(r.fine)}</b></p>}
                    {r.pending > 0 && <p className="pt-2 text-xs text-slate-500">Pay at the accounts office or online; the office will record your payment and a receipt will appear below.</p>}
                  </div>
                </div>
              </Card>
            ))}
            {data.records.length === 0 && <Card><p className="text-sm text-slate-500">No fee structures apply to your semester yet.</p></Card>}
            <Card title="Payment history" bodyClass="p-0">
              <DataTable rows={data.payments} empty={{ title: "No payments yet" }} columns={[
                { key: "receiptNo", label: "Receipt", render: (p) => <span className="font-mono text-xs">{p.receiptNo}</span> },
                { key: "paidAt", label: "Date", render: (p) => fmtDateTime(p.paidAt) },
                { key: "fee", label: "Fee", render: (p) => p.fee?.name },
                { key: "amount", label: "Amount", render: (p) => fmtMoney(p.amount + (p.fine || 0)) },
                { key: "method", label: "Method", hideOn: "sm", render: (p) => titleCase(p.method) },
                { key: "a", label: "", className: "text-right", render: (p) => <Button size="sm" variant="soft" icon={Receipt} onClick={() => setReceipt(p._id)}>Receipt</Button> },
              ]} />
            </Card>
          </div>
        )}
      </AsyncBlock>
      <ReceiptModal id={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
