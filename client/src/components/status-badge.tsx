import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "pending" | "approved" | "verified" | "rejected" | "not_submitted" | "user" | "admin";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case "approved":
      case "verified":
        return "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200";
      case "pending":
        return "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-200";
      case "rejected":
        return "bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-200";
      case "admin":
        return "bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getLabel = (s: string) => {
    if (s === "not_submitted") return "Not Submitted";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <Badge variant="outline" className={cn("capitalize font-medium border", getStyles(status), className)}>
      {getLabel(status)}
    </Badge>
  );
}
