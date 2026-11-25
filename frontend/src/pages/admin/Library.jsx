import { useState } from "react";
import { BookCopy, BookOpen, Library as LibraryIcon, AlertTriangle, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import ResourcePage from "../../features/resource/ResourcePage";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Badge, Button, Card, Checkbox, DataTable, Field, FilterSelect, Input, Modal, PageHeader, Pagination, StatCard, Tabs, useConfirm } from "../../components/ui";
import { fmtDate, fmtMoney } from "../../utils/format";

function IssueModal({ book, onClose }) {
  const [q, setQ] = useState("");
  const [student, setStudent] = useState(null);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: found } = useApi(q.length >= 2 && !student ? "/students" : null, { search: q, limit: 8, status: "active" });
  const submit = async () => {
    if (!student) return toast.error("Select a student");
    setBusy(true);
    try {
      const { data } = await api.post("/library/issues", { book: book._id, student: student._id, dueDate: due || undefined });
      toast.success(data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} title={`Issue "${book.title}"`} subtitle={`${book.availableCopies} of ${book.totalCopies} copies available`}
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button loading={busy} onClick={submit}>Issue book</Button></>}>
      <div className="space-y-4">
        <Field label="Student" hint="Search by name, roll number or ID">
          <Input value={student ? `${student.rollNumber} — ${student.user?.name}` : q} onChange={(e) => { setQ(e.target.value); setStudent(null); }} />
          {!student && found?.length > 0 && (
            <ul className="mt-1 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {found.map((s) => <li key={s._id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setStudent(s)}>{s.rollNumber} — {s.user?.name}</button></li>)}
            </ul>
          )}
        </Field>
        <Field label="Due date" hint="Defaults to the loan period in settings"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function Issues() {
  const confirm = useConfirm();
  const [status, setStatus] = useState("issued");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useApi("/library/issues", { page, limit: 15, status: overdue ? undefined : status || undefined, overdue: overdue ? "true" : undefined });
  const ret = async (r) => {
    const ok = await confirm({ title: "Return book?", message: r.currentFine ? `Late by due date — fine ${fmtMoney(r.currentFine)} will be recorded as collected.` : "Mark this book as returned." });
    if (!ok) return;
    try {
      const { data: res } = await api.patch(`/library/issues/${r._id}/return`, { finePaid: true });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card bodyClass="p-0" title="Issued books" actions={
      <>
        <Checkbox label="Overdue only" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(1); }} />
        {!overdue && <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "issued", label: "Issued" }, { value: "returned", label: "Returned" }, { value: "lost", label: "Lost" }]} placeholder="All" />}
      </>
    }>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: "No issue records" }} columns={[
        { key: "book", label: "Book", render: (r) => <div><p className="font-medium">{r.book?.title}</p><p className="text-xs text-slate-500">{r.book?.author}</p></div> },
        { key: "student", label: "Student", render: (r) => `${r.student?.rollNumber} — ${r.student?.user?.name}` },
        { key: "issueDate", label: "Issued", hideOn: "md", render: (r) => fmtDate(r.issueDate) },
        { key: "dueDate", label: "Due", render: (r) => <span className={r.isOverdue ? "font-medium text-rose-600" : ""}>{fmtDate(r.dueDate)}</span> },
        { key: "fine", label: "Fine", render: (r) => (r.currentFine ? fmtMoney(r.currentFine) : "—") },
        { key: "status", label: "Status", render: (r) => <Badge status={r.isOverdue ? "overdue" : r.status} /> },
        { key: "a", label: "", className: "text-right", render: (r) => r.status === "issued" && <Button size="sm" variant="soft" icon={Undo2} onClick={() => ret(r)}>Return</Button> },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
    </Card>
  );
}

export default function Library() {
  const [tab, setTab] = useState("books");
  const [issuing, setIssuing] = useState(null);
  const [refetchBooks, setRefetchBooks] = useState(null);
  const { data: stats, refetch: refetchStats } = useApi("/library/stats", { tab });
  const { data: categories } = useApi("/library/categories");
  return (
    <>
      <PageHeader title="Library Management" subtitle="Books, inventory, issues, returns and fines" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Titles" value={stats?.titles} loading={!stats} icon={LibraryIcon} />
        <StatCard label="Available copies" value={stats ? `${stats.availableCopies}/${stats.totalCopies}` : null} loading={!stats} icon={BookCopy} tone="green" />
        <StatCard label="Issued" value={stats?.issued} loading={!stats} icon={BookOpen} tone="violet" />
        <StatCard label="Overdue" value={stats?.overdue} loading={!stats} icon={AlertTriangle} tone="red" hint={stats && `Fines collected ${fmtMoney(stats.finesCollected)}`} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "books", label: "Books & inventory" }, { value: "issues", label: "Issues & returns" }]} />
      {tab === "books" ? (
        <ResourcePage config={{
          title: "Books", endpoint: "/library/books", entity: "Book", defaultSort: "title", pageSize: 12,
          searchPlaceholder: "Search title, author, ISBN…",
          filters: [{ key: "category", label: "All categories", options: (categories || []).map((c) => ({ value: c, label: c })) }],
          columns: [
            { key: "title", label: "Title", sortable: true, render: (b) => <div><p className="font-medium text-slate-900">{b.title}</p><p className="text-xs text-slate-500">{b.author}</p></div> },
            { key: "category", label: "Category", sortable: true },
            { key: "isbn", label: "ISBN", hideOn: "lg" },
            { key: "shelf", label: "Shelf", hideOn: "md" },
            { key: "copies", label: "Available", render: (b) => <Badge tone={b.availableCopies ? "green" : "red"}>{b.availableCopies}/{b.totalCopies}</Badge> },
          ],
          fields: [
            { name: "title", label: "Title", required: true, colSpan: 2 },
            { name: "author", label: "Author", required: true },
            { name: "category", label: "Category", required: true, placeholder: "Computer Science" },
            { name: "isbn", label: "ISBN" },
            { name: "publisher", label: "Publisher" },
            { name: "edition", label: "Edition" },
            { name: "shelf", label: "Shelf / location" },
            { name: "totalCopies", label: "Total copies", type: "number", required: true, min: 0 },
          ],
          defaults: { totalCopies: 1 },
          toPayload: (v) => ({ ...v, totalCopies: Number(v.totalCopies) }),
          deleteParams: { permanent: true },
          rowActions: (b, { refetch }) => <Button size="sm" variant="soft" disabled={!b.availableCopies} onClick={() => { setIssuing(b); setRefetchBooks(() => refetch); }}>Issue</Button>,
        }} />
      ) : <Issues />}
      {issuing && <IssueModal book={issuing} onClose={(c) => { setIssuing(null); if (c) { refetchBooks?.(); refetchStats(); } }} />}
    </>
  );
}

export function StudentLibrary() {
  const { data, loading, error, refetch } = useApi("/library/issues", { limit: 50 });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data: books, meta } = useApi("/library/books", { search: q || undefined, page, limit: 10 });
  return (
    <>
      <PageHeader title="Library" subtitle="Your issued books, due dates and fines" />
      <Card title="My books" bodyClass="p-0" className="mb-6">
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: "No books issued", message: "Visit the library to borrow books." }} columns={[
          { key: "book", label: "Book", render: (r) => <div><p className="font-medium">{r.book?.title}</p><p className="text-xs text-slate-500">{r.book?.author} · {r.book?.isbn}</p></div> },
          { key: "issueDate", label: "Issued", render: (r) => fmtDate(r.issueDate) },
          { key: "dueDate", label: "Due", render: (r) => <span className={r.isOverdue ? "font-medium text-rose-600" : ""}>{fmtDate(r.dueDate)}</span> },
          { key: "returnDate", label: "Returned", hideOn: "sm", render: (r) => fmtDate(r.returnDate) },
          { key: "fine", label: "Fine", render: (r) => (r.currentFine ? fmtMoney(r.currentFine) : "—") },
          { key: "status", label: "Status", render: (r) => <Badge status={r.isOverdue ? "overdue" : r.status} /> },
        ]} />
      </Card>
      <Card title="Catalogue" bodyClass="p-0" actions={<Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search books…" className="w-56" />}>
        <DataTable rows={books} loading={!books} empty={{ title: "No books found" }} columns={[
          { key: "title", label: "Title", render: (b) => <div><p className="font-medium">{b.title}</p><p className="text-xs text-slate-500">{b.author}</p></div> },
          { key: "category", label: "Category" },
          { key: "shelf", label: "Shelf", hideOn: "sm" },
          { key: "available", label: "Available", render: (b) => <Badge tone={b.availableCopies ? "green" : "red"}>{b.availableCopies ? `${b.availableCopies} available` : "Not available"}</Badge> },
        ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
