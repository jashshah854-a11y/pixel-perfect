import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Building2, Bot, ListTodo, FileText, Inbox,
  Volume2, VolumeX, ChevronLeft, ChevronRight,
  BarChart3, Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { isMuted, setMuted } from "@/lib/sounds";

const navItems = [
  { label: "Office",       path: "/",            icon: Building2 },
  { label: "Tasks",        path: "/tasks",       icon: ListTodo },
  { label: "Agents",       path: "/agents",      icon: Bot },
  { label: "Plans",        path: "/plans",       icon: FileText },
  { label: "Analytics",    path: "/analytics",   icon: BarChart3 },
  { label: "Deliverables", path: "/deliverables",icon: Package },
  { label: "Inbox",        path: "/inbox",       icon: Inbox },
];

interface LayoutProps {
  children: ReactNode;
  totalTokens?: number;
  unreadCount?: number;
}

export function Layout({ children, totalTokens = 0, unreadCount = 0 }: LayoutProps) {
  const location = useLocation();
  const [soundOff, setSoundOff] = useState(isMuted());
  const [expanded, setExpanded] = useState(false);

  const toggleSound = () => {
    const next = !soundOff;
    setSoundOff(next);
    setMuted(next);
  };

  return (
    <div className="relative min-h-screen flex flex-col md:flex-row w-full">
      {/* Ambient atmospheric glow — subtle, fixed, drifts slowly */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[120vw] h-[80vh] rounded-full blur-3xl animate-ambient-drift"
          style={{
            background: "radial-gradient(ellipse at center, oklch(70% 0.18 250 / 0.08) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[60vw] h-[60vh] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(ellipse at center, oklch(60% 0.20 290 / 0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ============= Desktop sidebar ============= */}
      <motion.aside
        initial={false}
        animate={{ width: expanded ? 224 : 64 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="hidden md:flex flex-col shrink-0 border-r bg-sidebar/60 backdrop-blur-xl"
        style={{
          minHeight: "100vh",
          position: "sticky",
          top: 0,
          borderColor: "oklch(100% 0 0 / 0.06)",
        }}
      >
        {/* Header */}
        <div className={`flex items-center h-14 border-b ${expanded ? "px-4 justify-between" : "justify-center px-2"}`}
             style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}>
          <AnimatePresence mode="wait">
            {expanded && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <div className="h-6 w-6 rounded-md bg-gradient-accent grid place-items-center shadow-glow-sm">
                  <span className="text-[10px] font-display font-bold text-primary-foreground">A</span>
                </div>
                <h1 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-foreground/80">
                  Aether
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 press-effect transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item, i) => {
            const active = location.pathname === item.path;
            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to={item.path}
                  title={expanded ? undefined : item.label}
                  className={`relative flex items-center rounded-md transition-all press-effect ${
                    expanded ? "gap-3 px-3 py-2" : "justify-center px-0 py-2"
                  } ${
                    active
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                  style={active ? {
                    background: "linear-gradient(90deg, oklch(70% 0.18 250 / 0.12) 0%, oklch(70% 0.18 250 / 0.02) 100%)",
                  } : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full"
                      style={{ background: "oklch(70% 0.18 250)", boxShadow: "0 0 8px oklch(70% 0.18 250 / 0.6)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <item.icon className={`shrink-0 transition-all ${expanded ? "h-[18px] w-[18px]" : "h-[18px] w-[18px]"} ${active ? "text-primary" : ""}`} />
                  {expanded && (
                    <span className="text-[13px] whitespace-nowrap">{item.label}</span>
                  )}
                  {item.label === "Inbox" && unreadCount > 0 && (
                    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-accent text-[9px] font-mono font-bold text-primary-foreground px-1 shadow-glow-sm ${
                      expanded ? "ml-auto" : "absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 text-[8px]"
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t py-3 px-2 space-y-2 ${expanded ? "" : "flex flex-col items-center"}`}
             style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}>
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="tokens"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-2 space-y-0.5"
              >
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">Tokens</p>
                <p className="text-[13px] text-mono tabular-nums text-foreground/90">
                  {totalTokens.toLocaleString()}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={toggleSound}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 press-effect transition-colors"
            title={soundOff ? "Unmute" : "Mute"}
          >
            {soundOff ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </motion.aside>

      {/* ============= Mobile header ============= */}
      <header
        className="sticky top-0 z-30 flex md:hidden h-12 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-4"
        style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-gradient-accent grid place-items-center">
            <span className="text-[9px] font-display font-bold text-primary-foreground">A</span>
          </div>
          <h1 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase">Aether</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-mono tabular-nums text-muted-foreground">
            {totalTokens.toLocaleString()}
          </span>
          <button onClick={toggleSound} className="p-1 text-muted-foreground press-effect">
            {soundOff ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <Link to="/inbox" className="relative">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-accent text-[8px] font-mono font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* ============= Main content ============= */}
      <main className="flex-1 overflow-hidden p-2 md:p-3 pb-16 md:pb-3">
        {children}
      </main>

      {/* ============= Mobile bottom tabs ============= */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t bg-background/85 backdrop-blur-xl py-2"
        style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}
      >
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 text-[10px] press-effect transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.label === "Inbox" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-accent text-[8px] font-mono font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
