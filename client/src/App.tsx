import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Sidebar } from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Positions from "@/pages/Positions";
import Dividends from "@/pages/Dividends";
import QualityCheck from "@/pages/QualityCheck";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Router hook={useHashLocation}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/positions" component={Positions} />
                <Route path="/dividends" component={Dividends} />
                <Route path="/quality" component={QualityCheck} />
                <Route component={NotFound} />
              </Switch>
            </Router>
          </main>
        </div>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
