import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Button, Card, FilterSelect, Modal, PageHeader, SkeletonRows, ErrorState, Tabs, useConfirm } from "../../components/ui";
import WeeklyTimetable, { TodayClasses } from "../../features/timetable/WeeklyTimetable";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { OPT, idOf } from "../../utils/options";
import { DAYS, todayName } from "../../utils/format";

function SlotModal({ slot, onClose }) {
  const isEdit = Boolean(slot?._id);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const fields = [
    { name: "section", label: "Class / section", type: "select", required: true, optionsFrom: OPT.section },
    { name: "subject", label: "Subject", type: "select", required: true, optionsFrom: { ...OPT.subject, requires: "section", params: (v) => ({ section: v.section }) } },
    { name: "faculty", label: "Faculty", type: "select", required: true, optionsFrom: OPT.faculty },
    { name: "room", label: "Room", required: true, placeholder: "CS-101" },
    { name: "day", label: "Day", type: "select", required: true, options: DAYS.map((d) => ({ value: d, label: d })) },
    { name: "startTime", label: "Start time", type: "time", required: true },
    { name: "endTime", label: "End time", type: "time", required: true },
  ];
  const save = async (v) => {
    if (v.endTime <= v.startTime) return toast.error("End time must be after start time");
    setSaving(true);
    try {
      const res = isEdit ? await api.put(`/timetable/${slot._id}`, v) : await api.post("/timetable", v);
      toast.success(res.data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!(await confirm({ title: "Delete this class slot?", tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api.delete(`/timetable/${slot._id}`);
      toast.success("Slot deleted");
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Modal open={Boolean(slot)} onClose={() => onClose(false)} title={isEdit ? "Edit class slot" : "Add class slot"} subtitle="Overlapping classes, faculty clashes and room clashes are blocked automatically."
      footer={<>{isEdit && <Button variant="ghost" className="mr-auto text-rose-600" icon={Trash2} onClick={remove}>Delete</Button>}<Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="slot-form" loading={saving}>Save slot</Button></>}>
      {slot && (
        <ResourceForm id="slot-form" fields={fields} isEdit={isEdit} onSubmit={save}
          defaultValues={isEdit ? { ...slot, section: idOf(slot.section), subject: idOf(slot.subject), faculty: idOf(slot.faculty) } : { day: "Monday", startTime: "09:00", endTime: "10:00", ...slot }} />
      )}
    </Modal>
  );
}

export default function Timetable() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [section, setSection] = useState("");
  const [faculty, setFaculty] = useState("");
  const [view, setView] = useState("week");
  const [editing, setEditing] = useState(null);
  const { options: sections } = useOptions(isAdmin || user.role === "faculty" ? "/sections" : null, OPT.section.map, user.role === "faculty" ? { mine: "true" } : undefined);
  const { options: faculties } = useOptions(isAdmin ? "/faculty" : null, OPT.faculty.map);
  const needsPick = isAdmin && !section && !faculty;
  const { data, loading, error, refetch } = useApi(needsPick ? null : "/timetable", { section: section || undefined, faculty: faculty || undefined });

  const today = (data || []).filter((s) => s.day === todayName());

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={isAdmin ? "Create and manage weekly class schedules" : user.role === "faculty" ? "Your weekly teaching schedule" : "Your weekly class schedule"}
        actions={isAdmin && <Button icon={Plus} onClick={() => setEditing(section ? { section } : {})}>Add slot</Button>}
      />
      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(isAdmin || user.role === "faculty") && <FilterSelect value={section} onChange={(v) => { setSection(v); if (v) setFaculty(""); }} options={sections} placeholder={isAdmin ? "Select class…" : "My schedule"} />}
            {isAdmin && <FilterSelect value={faculty} onChange={(v) => { setFaculty(v); if (v) setSection(""); }} options={faculties} placeholder="…or select faculty" />}
          </div>
          <Tabs value={view} onChange={setView} tabs={[{ value: "week", label: "Weekly" }, { value: "day", label: "Today" }]} />
        </div>
        <div className="p-4">
          {needsPick ? (
            <p className="py-14 text-center text-sm text-slate-500">Select a class or faculty member to view the timetable.</p>
          ) : loading && !data ? <SkeletonRows rows={6} cols={6} /> : error ? <ErrorState message={error} onRetry={refetch} /> : view === "week" ? (
            <WeeklyTimetable slots={data || []} show={user.role === "faculty" || faculty ? "section" : "faculty"} onSlotClick={isAdmin ? (s) => setEditing(s) : undefined} />
          ) : (
            <TodayClasses slots={today} show={user.role === "faculty" || faculty ? "section" : "faculty"} />
          )}
        </div>
      </Card>
      {isAdmin && <SlotModal slot={editing} onClose={(changed) => { setEditing(null); if (changed) refetch(); }} />}
    </>
  );
}
