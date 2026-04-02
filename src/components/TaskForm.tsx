import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

interface Agent {
  id: string;
  name: string;
}

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  defaultAgent?: string;
  onSubmit: (task: {
    title: string;
    description: string;
    priority: string;
    assigned_to: string | null;
    source: string;
  }) => void;
}

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  const aWords = new Set(al.split(/\s+/));
  const bWords = new Set(bl.split(/\s+/));
  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union === 0 ? 0 : intersection / union;
}

export function TaskForm({ open, onClose, agents, defaultAgent, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState(defaultAgent || "");
  const [source, setSource] = useState("manual");
  const [dupWarning, setDupWarning] = useState<{ title: string; status: string } | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  const { data: existingTasks } = useQuery({
    queryKey: ["tasks-for-dedup"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("title, status").limit(200);
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!title.trim() || !existingTasks?.length) {
      setDupWarning(null);
      setForceCreate(false);
      return;
    }
    const timer = setTimeout(() => {
      let bestMatch: { title: string; status: string; score: number } | null = null;
      for (const t of existingTasks) {
        const score = similarity(title, t.title);
        if (score >= 0.6 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { title: t.title, status: t.status, score };
        }
      }
      setDupWarning(bestMatch ? { title: bestMatch.title, status: bestMatch.status } : null);
      setForceCreate(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [title, existingTasks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (dupWarning && !forceCreate) {
      setForceCreate(true);
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      assigned_to: assignedTo || null,
      source,
    });
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssignedTo("");
    setSource("manual");
    setDupWarning(null);
    setForceCreate(false);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-card border-border">
        <SheetHeader>
          <SheetTitle>New Task</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
            {dupWarning && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 font-medium">Similar task found</p>
                  <p className="text-muted-foreground mt-0.5">
                    "{dupWarning.title}" ({dupWarning.status})
                  </p>
                  {forceCreate && (
                    <p className="text-amber-400/80 mt-1">Click "Create Task" again to confirm.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details..." />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Assign to</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">⚡ Auto-assign (AI routing)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {!assignedTo && (
              <p className="text-[10px] text-muted-foreground mt-1">Agents will evaluate and claim this task automatically</p>
            )}
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="manual">Manual</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          <Button type="submit" className="w-full">
            {dupWarning && forceCreate ? "Create Anyway" : "Create Task"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
