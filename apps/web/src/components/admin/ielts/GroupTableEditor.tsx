"use client";

/**
 * Table stimulus editor for question groups: a headers row plus a grid of
 * cells where any cell can be toggled into a gap (slot id + optional label).
 * Compact workbench grid; wide tables scroll inside the panel, never the page.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { emptyCell, nextSlotId, type TableCellState } from "./authoring-utils";
import { Field } from "./ielts-ui";

interface Props {
  caption: string;
  headers: string[];
  rows: TableCellState[][];
  onChange: (next: { caption: string; headers: string[]; rows: TableCellState[][] }) => void;
}

function usedSlots(rows: TableCellState[][]): string[] {
  return rows.flatMap((row) => row.filter((c) => c.gap).map((c) => c.slot));
}

function CellEditor({
  cell,
  onChange,
}: {
  cell: TableCellState;
  onChange: (next: TableCellState) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-40 flex-col gap-1 rounded-lg border p-1.5",
        cell.gap ? "border-primary bg-primary-container" : "border-outline-variant",
      )}
    >
      {cell.gap ? (
        <div className="flex gap-1">
          <Input
            value={cell.slot}
            onChange={(e) => onChange({ ...cell, slot: e.target.value })}
            placeholder="slot"
            aria-label="Gap slot"
            className="w-16"
          />
          <Input
            value={cell.label}
            onChange={(e) => onChange({ ...cell, label: e.target.value })}
            placeholder="label"
            aria-label="Gap label"
          />
        </div>
      ) : (
        <Input
          value={cell.text}
          onChange={(e) => onChange({ ...cell, text: e.target.value })}
          placeholder="cell text"
          aria-label="Cell text"
        />
      )}
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        onClick={() => onChange({ ...cell, gap: !cell.gap })}
      >
        {cell.gap ? "Make text" : "Make gap"}
      </Button>
    </div>
  );
}

export function GroupTableEditor({ caption, headers, rows, onChange }: Props) {
  const emit = (patch: Partial<{ caption: string; headers: string[]; rows: TableCellState[][] }>) =>
    onChange({ caption, headers, rows, ...patch });

  function setHeader(index: number, value: string) {
    emit({ headers: headers.map((h, i) => (i === index ? value : h)) });
  }

  function setCell(rowIndex: number, colIndex: number, next: TableCellState) {
    const resolved =
      next.gap && !next.slot ? { ...next, slot: nextSlotId(usedSlots(rows)) } : next;
    emit({
      rows: rows.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === colIndex ? resolved : cell)) : row,
      ),
    });
  }

  function addColumn() {
    emit({ headers: [...headers, ""], rows: rows.map((row) => [...row, emptyCell()]) });
  }

  function removeColumn() {
    if (headers.length <= 1) return;
    emit({ headers: headers.slice(0, -1), rows: rows.map((row) => row.slice(0, -1)) });
  }

  function addRow() {
    emit({ rows: [...rows, headers.map(() => emptyCell())] });
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    emit({ rows: rows.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Caption (optional)">
        <Input value={caption} onChange={(e) => emit({ caption: e.target.value })} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="h-4 w-4" /> Column
        </Button>
        <Button variant="ghost" size="sm" onClick={removeColumn} disabled={headers.length <= 1}>
          Remove last column
        </Button>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" /> Row
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-outline-variant p-2">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {headers.map((header, index) => (
              <Input
                key={index}
                value={header}
                onChange={(e) => setHeader(index, e.target.value)}
                placeholder={`Header ${index + 1}`}
                aria-label={`Header ${index + 1}`}
                className="min-w-40 flex-1"
              />
            ))}
            <span className="w-7 shrink-0" />
          </div>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-start gap-2">
              {row.map((cell, colIndex) => (
                <CellEditor
                  key={colIndex}
                  cell={cell}
                  onChange={(next) => setCell(rowIndex, colIndex, next)}
                />
              ))}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeRow(rowIndex)}
                disabled={rows.length <= 1}
                aria-label="Remove row"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
