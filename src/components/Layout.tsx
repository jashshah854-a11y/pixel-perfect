import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Bot, ListTodo, FileText, Inbox, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
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
      {/* Desktop sidebar — always visible */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r bg-card/50 backdrop-blur-sm transition-[width] duration-300 ease-in-out ${
          expanded ? "w-52" : "w-[60px]"
        }`}
        style={{ minHeight: "100vh", position: "sticky", top: 0 }}
      >
        {/* Header */}
        <div className={`flex items-center border-b border-border/30 h-12 ${expanded ? "px-4 justify-between" : "justify-center"}`}>
          {expanded && (
            <h1 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground whitespace-nowrap">
              Agent Office
            </h1>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={expanded ? undefined : item.label}
                className={`flex items-center gap-3 rounded-lg transition-colors ${
                  expanded ? "px-3 py-2.5" : "justify-center px-0 py-2.5"
                } ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {expanded && (
                  <span className="text-sm whitespace-nowrap">{item.label}</span>
                )}
                {item.label === "Inbox" && unreadCount > 0 && (
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 ${
                    expanded ? "ml-auto" : "absolute -mt-4 ml-3"
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
            <p className="text-[10px] text-muted-foreground font-mono px-1">{totalTokens.toLocaleString()} tokens</p>
          )}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors ${
              expanded ? "" : ""
            }`}
            title={soundOff ? "Unmute sounds" : "Mute sounds"}
          >
            {soundOff ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex md:hidden h-12 items-center justify-between border-b bg-background px-4">
        <h1 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Agent Office</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">{totalTokens.toLocaleString()}</span>
          <button onClick={toggleSound} className="p-1 text-muted-foreground">
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
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>

      {/* Mobile bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t bg-background py-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 text-[10px] ${
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
