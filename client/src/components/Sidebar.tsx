import { useHashLocation } from "wouter/use-hash-location";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, TrendingUp, DollarSign, ShieldCheck, Sun, Moon
} from "lucide-react";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/positions", label: "Portefeuille", icon: TrendingUp },
  { href: "/dividends", label: "Dividendes", icon: DollarSign },
  { href: "/quality", label: "Critères Quality", icon: ShieldCheck },
];

export function Sidebar() {
  const [location, navigate] = useHashLocation();
  const { theme, toggle } = useTheme();

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border/60 bg-card">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="Portfolio Quality Tracker logo">
            <rect width="32" height="32" rx="8" fill="hsl(158 64% 42%)"/>
            <path d="M8 22 L14 14 L18 18 L22 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="22" cy="10" r="2.5" fill="white"/>
            <path d="M8 26 H24" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          </svg>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>Quality</p>
            <p className="text-xs text-muted-foreground leading-tight">Portfolio</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href === "/" && (location === "" || location === "/"));
          return (
            <a
              key={href}
              href={`#${href}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(href);
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer",
                active
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              data-testid={`nav-${href.replace("/", "") || "dashboard"}`}
            >
              <Icon size={16} />
              {label}
            </a>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-4 py-4 border-t border-border/60">
        <button
          onClick={toggle}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground/50">
          <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">
            Créé avec Perplexity Computer
          </a>
        </p>
      </div>
    </aside>
  );
}
