"use client";

/**
 * Admin management of per-test band_conversions (WS-2.2): list every raw→band
 * table and create/edit/delete one. A "table" is the full band ladder for one
 * (conversion_key, skill, module); the seeded 'default' is the grader's
 * fallback, and a test opts into a custom table via
 * `test.metadata.band_conversion_key`. Mutations go through the admin-guarded
 * server actions — no inline data access. Design-system tokens only.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  deleteBandConversionTableAction,
  replaceBandConversionTableAction,
} from "@/app/actions/ielts";
import type {
  BandConversionModuleKey,
  BandConversionSkill,
  BandConversionTableGroup,
} from "@/lib/api/ielts/content-schema";
import { Field } from "./ielts-ui";

const BAND_LADDER = [
  9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0,
];

type DraftCells = Record<string, { min: string; max: string }>;

function bandKey(band: number): string {
  return band.toFixed(1);
}

function moduleLabel(module: BandConversionModuleKey | null): string {
  if (module === "academic") return "Academic";
  if (module === "general_training") return "General Training";
  return "—";
}

function cellsFrom(table: BandConversionTableGroup | null): DraftCells {
  const cells: DraftCells = {};
  for (const band of BAND_LADDER) cells[bandKey(band)] = { min: "", max: "" };
  for (const row of table?.rows ?? []) {
    cells[bandKey(row.band)] = { min: String(row.rawMin), max: String(row.rawMax) };
  }
  return cells;
}

function TableEditor({
  initial,
  onClose,
}: {
  initial: BandConversionTableGroup | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = initial === null;
  const [conversionKey, setConversionKey] = useState(initial?.conversionKey ?? "");
  const [skill, setSkill] = useState<BandConversionSkill>(initial?.skill ?? "reading");
  const [module, setModule] = useState<BandConversionModuleKey | "">(
    initial?.module ?? "academic",
  );
  const [cells, setCells] = useState<DraftCells>(() => cellsFrom(initial));
  const [saving, setSaving] = useState(false);

  function setCell(band: string, field: "min" | "max", value: string) {
    setCells((prev) => ({ ...prev, [band]: { ...prev[band], [field]: value } }));
  }

  async function save() {
    const rows = BAND_LADDER.map((band) => ({ band, cell: cells[bandKey(band)] }))
      .filter(({ cell }) => cell.min.trim() !== "" && cell.max.trim() !== "")
      .map(({ band, cell }) => ({
        band,
        rawMin: Number(cell.min),
        rawMax: Number(cell.max),
      }));
    if (rows.length === 0) {
      toast.error("Add a raw-score range for at least one band.");
      return;
    }
    setSaving(true);
    try {
      await replaceBandConversionTableAction({
        conversionKey: conversionKey.trim(),
        skill,
        module: skill === "listening" ? null : module || null,
        rows,
      });
      toast.success("Band table saved");
      router.refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Conversion key" hint="e.g. default or cam-19-test-1">
          <Input
            value={conversionKey}
            onChange={(e) => setConversionKey(e.target.value)}
            placeholder="default"
            disabled={!isNew}
          />
        </Field>
        <Field label="Skill">
          <Select
            value={skill}
            onChange={(e) => setSkill(e.target.value as BandConversionSkill)}
            disabled={!isNew}
          >
            <option value="reading">reading</option>
            <option value="listening">listening</option>
          </Select>
        </Field>
        <Field label="Module" hint="Reading only">
          <Select
            value={module}
            onChange={(e) => setModule(e.target.value as BandConversionModuleKey | "")}
            disabled={!isNew || skill === "listening"}
          >
            <option value="academic">academic</option>
            <option value="general_training">general_training</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="type-label text-on-surface">Raw-score ranges (/40)</span>
        <p className="type-caption text-on-surface-variant">
          Leave a band blank to omit it. Ranges should tile 0–40 without gaps.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BAND_LADDER.map((band) => {
            const key = bandKey(band);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-10 shrink-0 type-body-sm font-semibold text-on-surface tabular-nums">
                  {key}
                </span>
                <Input
                  inputMode="numeric"
                  value={cells[key].min}
                  onChange={(e) => setCell(key, "min", e.target.value)}
                  placeholder="min"
                  aria-label={`Band ${key} minimum raw`}
                />
                <span className="text-on-surface-variant">–</span>
                <Input
                  inputMode="numeric"
                  value={cells[key].max}
                  onChange={(e) => setCell(key, "max", e.target.value)}
                  placeholder="max"
                  aria-label={`Band ${key} maximum raw`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving || !conversionKey.trim()}>
          {saving ? "Saving…" : "Save table"}
        </Button>
      </div>
    </div>
  );
}

function TableCard({
  table,
  onEdit,
  onDeleted,
}: {
  table: BandConversionTableGroup;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete the "${table.conversionKey}" ${table.skill} table?`)) return;
    setDeleting(true);
    try {
      await deleteBandConversionTableAction({
        conversionKey: table.conversionKey,
        skill: table.skill,
        module: table.module,
      });
      toast.success("Table deleted");
      router.refresh();
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
      <div className="min-w-0">
        <p className="type-title text-on-surface">{table.conversionKey}</p>
        <p className="type-caption text-on-surface-variant">
          {table.skill} · {moduleLabel(table.module)} · {table.rows.length} bands
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" onClick={onEdit} disabled={deleting}>
          Edit
        </Button>
        <Button variant="ghost" onClick={remove} disabled={deleting}>
          {deleting ? "…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

export function BandConversionsClient({
  tables,
}: {
  tables: BandConversionTableGroup[];
}) {
  const [editing, setEditing] = useState<BandConversionTableGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const editorKey = useMemo(
    () => (editing ? `${editing.conversionKey}:${editing.skill}:${editing.module}` : "new"),
    [editing],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="type-heading-lg text-on-surface">IELTS band conversions</h1>
          <p className="type-body-sm text-on-surface-variant">
            Raw-score → band tables. &apos;default&apos; is the fallback; a test
            opts into its own via metadata.band_conversion_key.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/admin/ielts"
            className="rounded-full px-4 py-2 type-label text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            Back to content
          </Link>
          {!creating && !editing ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New table
            </Button>
          ) : null}
        </div>
      </div>

      {creating ? (
        <TableEditor key="new" initial={null} onClose={() => setCreating(false)} />
      ) : null}
      {editing ? (
        <TableEditor key={editorKey} initial={editing} onClose={() => setEditing(null)} />
      ) : null}

      <div className="flex flex-col gap-2">
        {tables.map((table) => (
          <TableCard
            key={`${table.conversionKey}:${table.skill}:${table.module}`}
            table={table}
            onEdit={() => {
              setCreating(false);
              setEditing(table);
            }}
            onDeleted={() => setEditing(null)}
          />
        ))}
        {tables.length === 0 ? (
          <p className="type-body-sm text-on-surface-variant">
            No band tables yet. The seeded &apos;default&apos; tables appear here
            once present.
          </p>
        ) : null}
      </div>
    </div>
  );
}
