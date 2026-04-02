import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Bot, ListTodo, FileText, Inbox, Volume2, VolumeX, ChevronLeft, ChevronRight, BarChart3, Package } from "lucide-react";
import { isMuted, setMuted } from "@/lib/sounds";

const navItems = [
  { label: "Office", path: "/", icon: Building2 },
  { label: "Tasks", path: "/tasks", icon: ListTodo },
  { label: "Agents", path: "/agents", icon: Bot },
  { label: "Plans", path: "/plans", icon: FileText },
  { label: "Inbox", path: "/inbox", icon: Inbox },
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
    <div className="min-h-screen flex flex-col md:flex-row w-full">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-border/40 bg-card/30 backdrop-blur-sm transition-[width] duration-slow ease-out-expo ${
          expanded ? "w-56" : "w-16"
        }`}
        style={{ minHeight: "100vh", position: "sticky", top: 0 }}
      >
        {/* Header */}
        <div className={`flex items-center h-14 border-b border-border/30 ${expanded ? "px-4 justify-between" : "justify-center px-2"}`}>
          {expanded && (
            <h1 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground whitespace-nowrap enter-fade">
              Agent Office
            </h1>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 press-effect transition-colors duration-fast"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={expanded ? undefined : item.label}
                className={`relative flex items-center rounded-lg transition-all duration-normal ease-out-expo press-effect ${
                  expanded ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5"
                } ${
                  active
                    ? "bg-primary/10 text-primary font-medium shadow-glow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                <item.icon className={`shrink-0 transition-all duration-fast ${expanded ? "h-[18px] w-[18px]" : "h-5 w-5"}`} />
                {expanded && (
                  <span className="text-sm whitespace-nowrap enter-fade">{item.label}</span>
                )}
                {item.label === "Inbox" && unreadCount > 0 && (
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 ${
                    expanded ? "ml-auto" : "absolute -top-0.5 -right-0.5 h-4 min-w-4 text-[8px]"
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-border/30 py-3 px-2 space-y-2 ${expanded ? "" : "flex flex-col items-center"}`}>
          {expanded && (
            <p className="text-[10px] text-muted-foreground font-mono tabular-nums px-2 enter-fade">
              {totalTokens.toLocaleString()} tokens
            </p>
          )}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 press-effect transition-colors duration-fast"
            title={soundOff ? "Unmute sounds" : "Mute sounds"}
          >
            {soundOff ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex md:hidden h-12 items-center justify-between border-b border-border/40 bg-background/95 backdrop-blur-sm px-4">
        <h1 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">Agent Office</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-muted-foreground">{totalTokens.toLocaleString()}</span>
          <button onClick={toggleSound} className="p-1 text-muted-foreground press-effect">
            {soundOff ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Link to="/inbox" className="relative">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden p-2 md:p-3 pb-16 md:pb-3">{children}</main>

      {/* Mobile bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-border/40 bg-background/95 backdrop-blur-sm py-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 text-[10px] press-effect transition-colors duration-fast ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.label === "Inbox" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
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
