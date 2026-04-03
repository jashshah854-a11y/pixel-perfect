import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { FileText, Download, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { CodeOutputViewer } from "./CodeOutputViewer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";

interface TaskOutputViewerProps {
  taskId: string;
  taskTitle: string;
  isCompleted: boolean;
}

export function TaskOutputViewer({ taskId, taskTitle, isCompleted }: TaskOutputViewerProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addingOutput, setAddingOutput] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("report");

  const { data: outputs } = useQuery({
    queryKey: ["task-outputs", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_outputs")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addOutput = useMutation({
    mutationFn: async () => {
      await supabase.from("task_outputs").insert({
        task_id: taskId,
        title: newTitle.trim() || `${taskTitle} — Output`,
        content: newContent.trim(),
        output_type: newType,
        format: "markdown",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-outputs", taskId] });
      setAddingOutput(false);
      setNewTitle("");
      setNewContent("");
      toast.success("Output saved");
    },
  });

  const generatePdf = (output: { title: string; content: string }) => {
    // Generate a downloadable markdown file (browser-side)
    const blob = new Blob(
      [`# ${output.title}\n\n${output.content}\n\n---\nGenerated from task: ${taskTitle}\nDate: ${new Date().toISOString()}`],
      { type: "text/markdown" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${output.title.replace(/\s+/g, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown exported");
  };

  const hasOutputs = (outputs?.length || 0) > 0;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
      >
        <FileText className="h-2.5 w-2.5" />
        Outputs {hasOutputs && `(${outputs?.length})`}
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {outputs?.map((o) => (
            <div key={o.id} className="rounded-md border border-border/30 bg-card/40 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">{o.output_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">{format(new Date(o.created_at), "MMM d, HH:mm")}</span>
                  <button onClick={() => generatePdf(o)} className="hover:text-primary transition-colors">
                    <Download className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                {o.content || "No content yet."}
              </div>
            </div>
          ))}

          {!hasOutputs && !addingOutput && (
            <p className="text-[10px] text-muted-foreground">No outputs yet.</p>
          )}

          {addingOutput ? (
            <div className="space-y-2 rounded-md border border-border/30 p-2.5">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Output title"
                className="h-7 text-xs"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1 text-xs"
              >
                <option value="report">Report</option>
                <option value="document">Document</option>
                <option value="code">Code</option>
                <option value="insight">Insight</option>
              </select>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Markdown content..."
                className="text-xs min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button size="sm" className="text-xs h-6" onClick={() => addOutput.mutate()} disabled={!newContent.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setAddingOutput(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            isCompleted && (
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-6 gap-1"
                onClick={() => setAddingOutput(true)}
              >
                <Plus className="h-2.5 w-2.5" /> Add Output
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
