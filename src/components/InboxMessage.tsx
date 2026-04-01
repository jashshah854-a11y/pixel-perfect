import { StatusBadge } from "./StatusBadge";
import { formatDistanceToNow } from "date-fns";

interface InboxMessageProps {
  message: {
    id: string;
    from_agent: string | null;
    message: string;
    type: string;
    read: boolean;
    created_at: string;
  };
  agentName?: string;
  onClick?: () => void;
}

export function InboxMessage({ message: msg, agentName, onClick }: InboxMessageProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border bg-card p-4 space-y-1 cursor-pointer hover:bg-accent/50 ${!msg.read ? "border-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{agentName || msg.from_agent || "System"}</span>
          <StatusBadge value={msg.type} />
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{msg.message}</p>
    </div>
  );
}
