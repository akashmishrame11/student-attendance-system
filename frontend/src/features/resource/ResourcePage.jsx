import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api, { errorMessage, toFormData } from "../../services/api";
import { useApi, useDebounce } from "../../hooks/useApi";
import { Button, Card, DataTable, FilterSelect, Modal, PageHeader, Pagination, SearchInput, useConfirm } from "../../components/ui";
import { ResourceForm } from "./ResourceForm";

function FilterControl({ filter, value, onChange }) {
  const { data } = useApi(filter.optionsFrom ? filter.optionsFrom.path : null, { all: "true", ...(filter.optionsFrom?.params || {}) });
  const options = filter.options || (data || []).map(filter.optionsFrom.map);
  return <FilterSelect value={value || ""} onChange={onChange} options={options} placeholder={filter.label} />;
}

/**
 * Config-driven CRUD page (list + search + filters + pagination + create/edit modal + delete).
 * See pages/admin/*.jsx for examples.
 */
export default function ResourcePage({ config }) {
  const {
    title, subtitle, endpoint, entity = "Record", columns, fields = [], filters = [], searchPlaceholder,
    toForm = (r) => r, toPayload = (v) => v, multipart, canCreate = true, canEdit = true, canDelete = true,
    deleteMessage, deleteParams, rowActions, headerActions, defaultSort = "-createdAt", pageSize = 10, extraParams = {}, modalSize = "md",
    onRowClick, hideSearch,
  } = config;

  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [filterValues, setFilterValues] = useState({});
  const [editing, setEditing] = useState(null); // null | {} (create) | row
  const [saving, setSaving] = useState(false);
  const q = useDebounce(search);

  const params = { page, limit: pageSize, sort, search: q || undefined, ...extraParams };
  for (const [k, v] of Object.entries(filterValues)) if (v) params[k] = v;
  const { data, meta, loading, error, refetch } = useApi(endpoint, params);

  const isEdit = Boolean(editing?._id);

  const save = async (values) => {
    setSaving(true);
    try {
      const payload = toPayload({ ...values }, isEdit);
      let body = payload;
      if (multipart) {
        const files = {};
        for (const [field, key] of Object.entries(multipart)) files[key] = payload[field];
        for (const field of Object.keys(multipart)) delete payload[field];
        body = toFormData(payload, files);
      }
      const res = isEdit ? await api.put(`${endpoint}/${editing._id}`, body) : await api.post(endpoint, body);
      toast.success(res.data.message || `${entity} saved`);
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: `Delete ${entity.toLowerCase()}?`,
      message: deleteMessage ? deleteMessage(row) : "This action cannot be undone.",
      tone: "danger",
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      const res = await api.delete(`${endpoint}/${row._id}`, { params: deleteParams });
      toast.success(res.data.message || `${entity} deleted`);
      if (data?.length === 1 && page > 1) setPage(page - 1);
      else refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const allowed = (v, row) => (typeof v === "function" ? v(row) : v);
  const hasActions = canEdit || canDelete || rowActions;
  const cols = hasActions
    ? [
        ...columns,
        {
          key: "_actions",
          label: "",
          headClass: "text-right",
          className: "text-right whitespace-nowrap",
          render: (row) => (
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {rowActions?.(row, { refetch })}
              {allowed(canEdit, row) && fields.length > 0 && (
                <Button size="icon" variant="ghost" onClick={() => setEditing(row)} aria-label="Edit" title="Edit"><Pencil className="h-4 w-4" /></Button>
              )}
              {allowed(canDelete, row) && (
                <Button size="icon" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => remove(row)} aria-label="Delete" title="Delete"><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          ),
        },
      ]
    : columns;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {headerActions?.({ refetch })}
            {canCreate && fields.length > 0 && <Button icon={Plus} onClick={() => setEditing({})}>Add {entity}</Button>}
          </>
        }
      />
      <Card bodyClass="p-0">
        {(!hideSearch || filters.length > 0) && (
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            {!hideSearch && <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={searchPlaceholder || `Search ${title.toLowerCase()}…`} className="w-full lg:w-72 lg:shrink-0" />}
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <FilterControl key={f.key} filter={f} value={filterValues[f.key]} onChange={(v) => { setFilterValues((s) => ({ ...s, [f.key]: v })); setPage(1); }} />
              ))}
            </div>
          </div>
        )}
        <DataTable
          columns={cols}
          rows={data}
          loading={loading && !data}
          error={error}
          onRetry={refetch}
          sort={sort}
          onSort={setSort}
          onRowClick={onRowClick}
          empty={{ title: `No ${title.toLowerCase()} found`, message: search || Object.values(filterValues).some(Boolean) ? "Try changing your search or filters." : canCreate && fields.length ? `Click "Add ${entity}" to create the first one.` : undefined }}
        />
        <Pagination meta={meta} onPage={setPage} />
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title={isEdit ? `Edit ${entity}` : `Add ${entity}`}
        size={modalSize}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="resource-form" loading={saving}>{isEdit ? "Save changes" : `Create ${entity}`}</Button>
          </>
        }
      >
        {editing && <ResourceForm key={editing._id || "new"} fields={fields} defaultValues={isEdit ? toForm(editing) : config.defaults || {}} onSubmit={save} isEdit={isEdit} />}
      </Modal>
    </>
  );
}
