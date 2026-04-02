import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Bot, ListTodo, FileText, Inbox } from "lucide-react";

const navItems = [
  { label: "Office", path: "/", icon: Building2 },
  { label: "Agents", path: "/agents", icon: Bot },
  { label: "Tasks", path: "/tasks", icon: ListTodo },
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 flex-col border-r bg-sidebar-background">
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Agent Office</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.label === "Inbox" && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground font-mono">{totalTokens.toLocaleString()} tokens used</p>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex md:hidden h-12 items-center justify-between border-b bg-background px-4">
        <h1 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Agent Office</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">{totalTokens.toLocaleString()}</span>
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
