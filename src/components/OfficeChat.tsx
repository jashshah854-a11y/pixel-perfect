import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatMessage {
  id: string;
  from_agent: string | null;
  message: string;
  created_at: string;
  type: string;
}

interface Agent {
  id: string;
  name: string;
}

export function OfficeChat({ agents }: { agents: Agent[] }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["office-chat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inbox")
        .select("*")
        .eq("type", "chat")
        .order("created_at", { ascending: true })
        .limit(50);
      return (data || []) as ChatMessage[];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const agentMap = agents.reduce<Record<string, string>>((acc, a) => {
    acc[a.id] = a.name;
    return acc;
  }, {});

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await supabase.from("inbox").insert({
        message: text,
        type: "chat",
        from_agent: null,
        read: true,
      });
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["office-chat"] });
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card flex flex-col h-64">
      <div className="px-3 py-2 border-b">
        <p className="text-xs font-medium text-muted-foreground">Chat Room</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {(!messages || messages.length === 0) && (
          <p className="text-xs text-muted-foreground/50 text-center py-6">No messages yet</p>
        )}
        {messages?.map((msg) => {
          const sender = msg.from_agent ? agentMap[msg.from_agent] || msg.from_agent : "You";
          return (
            <div key={msg.id} className="text-xs">
              <span className={`font-medium ${msg.from_agent ? "text-primary" : "text-foreground"}`}>
                {sender}:
              </span>{" "}
              <span className="text-muted-foreground">{msg.message}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t px-3 py-2 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
