import { STATUS_META, TONE_CLASSES, type DayStatus } from "@/lib/rules";

export default function StatusBadge({ status, className = "" }: { status: DayStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`badge ${TONE_CLASSES[meta.tone]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
