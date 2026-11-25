import { useState } from "react";
import { Printer } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Badge, Button, Field, Input, Modal, Select, Spinner } from "../../components/ui";
import ExportButtons from "../ExportButtons";
import { fmtDate, fmtDateTime, fmtMoney, titleCase } from "../../utils/format";

export const METHODS = ["cash", "upi", "card", "bank_transfer", "cheque", "online"].map((m) => ({ value: m, label: titleCase(m) }));

/** Printable fee receipt. */
export function ReceiptModal({ id, onClose }) {
  const { data: p, loading } = useApi(id ? `/fees/payments/${id}` : null);
  const { data: settings } = useApi(id ? "/settings/public" : null);
  return (
    <Modal open={Boolean(id)} onClose={onClose} title="Payment receipt" footer={<><Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button><ExportButtons size="md" path={`/fees/payments/${id}/pdf`} formats={["pdf"]} /></>}>
      {loading || !p ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <div className="print-area space-y-5 text-sm">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">{settings?.collegeName || "College"}</p>
              <p className="text-xs text-slate-500">Fee Receipt · Academic year {p.fee?.academicYear}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold">{p.receiptNo}</p>
              <p className="text-xs text-slate-500">{fmtDateTime(p.paidAt)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-slate-500">Student</p><p className="font-medium">{p.student?.user?.name}</p><p className="text-xs text-slate-500">{p.student?.rollNumber} · {p.student?.studentId}</p></div>
            <div><p className="text-xs text-slate-500">Course</p><p className="font-medium">{p.fee?.course?.name}</p><p className="text-xs text-slate-500">{p.fee?.semester?.name} · Section {p.student?.section?.name || "—"}</p></div>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>
              <tr className="border-b border-slate-100"><td className="py-2">{p.fee?.name}</td><td className="py-2 text-right">{fmtMoney(p.amount)}</td></tr>
              {p.fine > 0 && <tr className="border-b border-slate-100"><td className="py-2">Late fine</td><td className="py-2 text-right">{fmtMoney(p.fine)}</td></tr>}
              <tr><td className="py-2 font-semibold">Total paid</td><td className="py-2 text-right font-semibold">{fmtMoney(p.amount + (p.fine || 0))}</td></tr>
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
            <p>Method: <b>{titleCase(p.method)}</b>{p.transactionId ? ` · Txn ${p.transactionId}` : ""}</p>
            <p className="text-right">Received by: {p.receivedBy?.name || "—"}</p>
          </div>
          <p className="text-center text-[11px] text-slate-400">This is a computer-generated receipt.</p>
        </div>
      )}
    </Modal>
  );
}

/** Record a payment for a student. If `studentId` is given, the student picker is skipped. */
export function PaymentModal({ open, onClose, studentId: fixedStudent, feeId: fixedFee }) {
  const [roll, setRoll] = useState("");
  const [studentId, setStudentId] = useState(fixedStudent || "");
  const { data: found } = useApi(!fixedStudent && roll.length >= 2 ? "/students" : null, { search: roll, limit: 8 });
  const { data: ledger, loading } = useApi(open && (fixedStudent || studentId) ? `/fees/student/${fixedStudent || studentId}` : null);
  const [fee, setFee] = useState(fixedFee || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  const record = ledger?.records.find((r) => r.fee._id === fee);

  const submit = async () => {
    if (!record) return toast.error("Select a fee");
    if (!Number(amount) || Number(amount) <= 0) return toast.error("Enter a valid amount");
    if (Number(amount) > record.pending) return toast.error(`Amount exceeds pending ${fmtMoney(record.pending)}`);
    setBusy(true);
    try {
      const { data } = await api.post("/fees/payments", { student: fixedStudent || studentId, fee, amount: Number(amount), method, transactionId: txn || undefined });
      toast.success(data.message);
      onClose(data.data._id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Modal open onClose={() => onClose(null)} title="Record fee payment" footer={<><Button variant="secondary" onClick={() => onClose(null)}>Cancel</Button><Button loading={busy} onClick={submit}>Record payment</Button></>}>
      <div className="space-y-4">
        {!fixedStudent && (
          <Field label="Find student" hint="Search by name, roll number or student ID">
            <Input value={roll} onChange={(e) => { setRoll(e.target.value); setStudentId(""); setFee(""); }} placeholder="e.g. BCS25001" />
            {!studentId && found?.length > 0 && (
              <ul className="mt-1 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {found.map((s) => (
                  <li key={s._id}><button type="button" onClick={() => { setStudentId(s._id); setRoll(`${s.rollNumber} — ${s.user?.name}`); }} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{s.rollNumber} — {s.user?.name} <span className="text-xs text-slate-500">({s.course?.code})</span></button></li>
                ))}
              </ul>
            )}
          </Field>
        )}
        {(fixedStudent || studentId) && (loading ? <Spinner /> : ledger && (
          <>
            <Field label="Fee">
              <Select value={fee} onChange={(e) => setFee(e.target.value)} options={ledger.records.map((r) => ({ value: r.fee._id, label: `${r.fee.name} — pending ${fmtMoney(r.pending)}` }))} />
            </Field>
            {record && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="slate">Total {fmtMoney(record.totalAmount)}</Badge><Badge tone="green">Paid {fmtMoney(record.paid)}</Badge><Badge tone="amber">Pending {fmtMoney(record.pending)}</Badge>
                {record.fine > 0 && <Badge tone="red">Late fine {fmtMoney(record.fine)} (added automatically)</Badge>}
                <span className="text-slate-500">Due {fmtDate(record.dueDate)}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Amount (₹)" required><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={record ? String(record.pending) : ""} /></Field>
              <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} placeholder={false} /></Field>
              <Field label="Transaction ID"><Input value={txn} onChange={(e) => setTxn(e.target.value)} /></Field>
            </div>
          </>
        ))}
      </div>
    </Modal>
  );
}
