import { useState } from "react";
import { Code, Copy, Check, Play, ExternalLink, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CodeOutputViewerProps {
  code: string;
  format: string;
  title: string;
  outputType: string;
}

export function CodeOutputViewer({ code, format, title, outputType }: CodeOutputViewerProps) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isComponent = format === "tsx" || format === "jsx";
  const isRunnable = isComponent || format === "html";

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const ext = format || "ts";
    const filename = title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}.${ext}`);
  };

  const buildPreviewHtml = () => {
    if (!isComponent) return "";
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body{margin:0;padding:16px;background:#0a0a0a;color:#fafafa;font-family:Inter,system-ui,sans-serif}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code.replace(/import .+ from .+;?\n?/g, "").replace(/export default /g, "const __Component__ = ")}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(__Component__));
  </script>
</body>
</html>`;
  };

  // Syntax highlighting (simple keyword-based)
  const highlightCode = (src: string) => {
    return src.split("\n").map((line, i) => (
      <div key={i} className="flex">
        <span className="inline-block w-8 text-right pr-3 select-none text-muted-foreground/30 text-[10px]">
          {i + 1}
        </span>
        <span className="flex-1">
          {highlightLine(line)}
        </span>
      </div>
    ));
  };

  const highlightLine = (line: string) => {
    // Simple regex-based highlighting
    if (line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("/*")) {
      return <span className="text-muted-foreground/50">{line}</span>;
    }
    if (line.trim().startsWith("import ") || line.trim().startsWith("export ")) {
      return <span className="text-primary/80">{line}</span>;
    }
    return <span>{line}</span>;
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{title}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">
            {format}
          </span>
          {outputType === "code" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground">
              executable
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={downloadFile}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          {isRunnable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 gap-1 text-[10px]"
              onClick={() => setPreviewOpen(!previewOpen)}
            >
              <Play className="h-3 w-3" />
              {previewOpen ? "Close" : "Preview"}
            </Button>
          )}
        </div>
      </div>

      {/* Code block */}
      <div className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed bg-background/50">
        {highlightCode(code)}
      </div>

      {/* Live preview iframe */}
      {previewOpen && isRunnable && (
        <div className="border-t border-border/30">
          <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live Preview</span>
          </div>
          <iframe
            srcDoc={buildPreviewHtml()}
            sandbox="allow-scripts"
            className="w-full h-64 border-0 bg-background"
            title="Code Preview"
          />
        </div>
      )}
    </div>
  );
}
