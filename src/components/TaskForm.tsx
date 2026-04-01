import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

export function TaskForm({ open, onClose, agents, defaultAgent, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState(defaultAgent || "");
  const [source, setSource] = useState("manual");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
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
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="manual">Manual</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          <Button type="submit" className="w-full">Create Task</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
