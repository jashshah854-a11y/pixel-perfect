import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import AgentsPage from "./pages/AgentsPage.tsx";
import TasksPage from "./pages/TasksPage.tsx";
import PlansPage from "./pages/PlansPage.tsx";
import JobsPage from "./pages/JobsPage.tsx";
import InboxPage from "./pages/InboxPage.tsx";
import IntegrationsPage from "./pages/IntegrationsPage.tsx";
import OfficePage from "./pages/OfficePage.tsx";
import AnalyticsPage from "./pages/AnalyticsPage.tsx";
import ClientViewPage from "./pages/ClientViewPage.tsx";
import DeliverablesPage from "./pages/DeliverablesPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<OfficePage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/deliverables" element={<ClientViewPage />} />
          <Route path="/office" element={<OfficePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
