import { useState } from "react";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { download, errorMessage } from "../services/api";
import { Button } from "../components/ui";

const FORMATS = [
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "csv", label: "CSV", icon: FileDown },
];

/** Download a server-generated export (Excel / PDF / CSV) of an endpoint. */
export default function ExportButtons({ path, params = {}, size = "sm", formats = ["xlsx", "pdf", "csv"] }) {
  const [busy, setBusy] = useState("");
  const run = async (format) => {
    setBusy(format);
    try {
      await download(path, { ...params, format });
    } catch (err) {
      // Blob error bodies need decoding to show the API message.
      let msg = errorMessage(err);
      try {
        const text = await err?.response?.data?.text?.();
        if (text) msg = JSON.parse(text).message || msg;
      } catch { /* not JSON */ }
      toast.error(msg);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATS.filter((f) => formats.includes(f.format)).map((f) => (
        <Button key={f.format} size={size} variant="secondary" icon={f.icon} loading={busy === f.format} onClick={() => run(f.format)}>
          {f.label}
        </Button>
      ))}
    </div>
  );
}
