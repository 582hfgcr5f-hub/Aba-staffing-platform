type PairingConfirmationProps = {
  open: boolean;
  technicianName: string;
  caseName: string;
  clientSchedule: string;
  technicianAvailability: string;
  travelStatus?: string;
  warningMessage?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isSaving?: boolean;
};

export function PairingConfirmation({
  open,
  technicianName,
  caseName,
  clientSchedule,
  technicianAvailability,
  travelStatus,
  warningMessage,
  confirmLabel = "Confirm Pairing",
  onCancel,
  onConfirm,
  isSaving = false,
}: PairingConfirmationProps) {
  if (!open) return null;

  const showWarning = Boolean(warningMessage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pairing Confirmation</p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">
          Pair {technicianName} with {caseName}?
        </h3>

        <div className={`mt-5 space-y-4 rounded-2xl p-4 text-sm text-slate-700 ${showWarning ? "border border-amber-200 bg-amber-50" : "border border-slate-200 bg-slate-50"}`}>
          {showWarning ? <p className="font-semibold text-amber-800">{warningMessage}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="font-semibold text-slate-900">Case:</p>
              <p className="mt-1">{clientSchedule}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-semibold text-slate-900">Travel:</p>
              <p className="mt-1">{travelStatus ?? "Needs Confirmation"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-semibold text-slate-900">Technician availability:</p>
              <p className="mt-1">{technicianAvailability}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="button" disabled={isSaving} onClick={onConfirm} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Confirming..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
