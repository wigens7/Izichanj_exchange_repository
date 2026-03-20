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
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50";
      case "pending":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50";
      case "rejected":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50";
      case "expired":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50";
      case "admin":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getLabel = (s: string) => {
    if (s === "not_submitted") return "Not Submitted";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <Badge variant="outline" className={cn("capitalize font-medium border text-[11px]", getStyles(status), className)}>
      {getLabel(status)}
    </Badge>
  );
}
