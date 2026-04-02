import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare } from "lucide-react";

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

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="rounded-lg border border-border/20 bg-card/40 backdrop-blur-sm flex flex-col h-36">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ scrollbarWidth: "thin" }}>
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground/30">
            <MessageSquare className="h-4 w-4" />
            <p className="text-[10px] tracking-wide uppercase">Command Channel</p>
          </div>
        )}
        {messages?.map((msg) => {
          const sender = msg.from_agent ? agentMap[msg.from_agent] || msg.from_agent : "You";
          return (
            <div key={msg.id} className="text-xs leading-relaxed">
              <span className={`font-medium ${msg.from_agent ? "text-primary" : "text-foreground"}`}>
                {sender}
              </span>{" "}
              <span className="text-muted-foreground">{msg.message}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border/15 px-3 py-1.5 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Command..."
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/30"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
