"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { importLeads } from "@/actions/leads";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { parseCsv } from "@/lib/utils";

const SAMPLE = "Name,Phone,Email,Source,Status,Priority,Purpose,Property Type,Location,BHK,Budget Min,Budget Max,Notes,Tags\nRahul Verma,9876543210,rahul@example.com,Website,New,Hot,Buy,Apartment,\"Baner, Pune\",2,8000000,10000000,Wants ready to move,Home Loan\n";

export function ImportLeadsButton({ users, canAssign }: { users: { id: string; name: string }[]; canAssign: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const rows = text ? parseCsv(text) : [];

  const downloadSample = () => {
    const blob = new Blob([SAMPLE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leads-import-sample.csv";
    a.click();
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload /> Import
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Import leads from CSV"
        description="Bulk upload leads from portals, Excel sheets or other CRMs. Duplicate phone numbers are skipped automatically."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={rows.length < 2}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await importLeads(text, assignTo || null);
                  if (res.error) return void toast.error(res.error);
                  toast.success(`Imported ${res.data?.created} lead(s)${res.data?.skipped ? `, skipped ${res.data.skipped} duplicate/invalid` : ""}`);
                  setOpen(false);
                  setText("");
                  setFileName("");
                  router.refresh();
                })
              }
            >
              Import {rows.length > 1 ? `${rows.length - 1} rows` : ""}
            </Button>
          </>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name);
            setText(await f.text());
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
        >
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FileText className="size-5" />
          </span>
          {fileName ? (
            <>
              <span className="text-sm font-medium text-slate-900">{fileName}</span>
              <span className="mt-1 text-xs text-slate-500">{Math.max(0, rows.length - 1)} data rows detected. Click to choose another file.</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-slate-900">Click to upload a CSV file</span>
              <span className="mt-1 text-xs text-slate-500">Required columns: Name, Phone</span>
            </>
          )}
        </button>
        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {rows[0].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(1, 4).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canAssign && (
          <Field label="Assign imported leads to" className="mt-4">
            <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Leave unassigned" />
          </Field>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Not sure about the format?{" "}
          <button type="button" onClick={downloadSample} className="font-medium text-brand-600 hover:underline">
            Download sample CSV
          </button>
        </p>
      </Modal>
    </>
  );
}
