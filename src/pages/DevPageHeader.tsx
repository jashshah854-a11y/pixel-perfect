import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Download, Settings, RefreshCw } from "lucide-react";

/**
 * Dev-only stress test for <PageHeader>. Renders the same component across
 * a matrix of edge cases (long strings, action counts, missing slots) so
 * baseline alignment can be visually verified pixel-for-pixel.
 *
 * Route: /dev/page-header
 */
const cases: Array<{
  id: string;
  note: string;
  props: Parameters<typeof PageHeader>[0];
}> = [
  {
    id: "baseline",
    note: "Baseline — short eyebrow, short title, short description, 1 action.",
    props: {
      eyebrow: "OFFICE",
      title: "Command Center",
      description: "Realtime status across all agents.",
      actions: <Button size="sm">New</Button>,
    },
  },
  {
    id: "no-desc-no-actions",
    note: "Minimum — no description, no actions.",
    props: { eyebrow: "PLANS", title: "Strategy" },
  },
  {
    id: "no-actions",
    note: "Description only, no actions.",
    props: {
      eyebrow: "INBOX",
      title: "Messages",
      description: "Conversations from the agent mesh.",
    },
  },
  {
    id: "long-eyebrow",
    note: "Long eyebrow (tracked-out 0.25em).",
    props: {
      eyebrow: "AUTONOMOUS · GHOST SWEEP · LIVE TELEMETRY",
      title: "Ops",
      description: "Eyebrow should never wrap or shift the title baseline.",
      actions: <Button size="sm">Run</Button>,
    },
  },
  {
    id: "long-title",
    note: "Long title — must truncate with ellipsis, not wrap.",
    props: {
      eyebrow: "PROJECT",
      title: "An Extraordinarily Long Project Title That Should Truncate Cleanly Without Pushing Actions",
      description: "Title uses `truncate` so actions stay right-aligned.",
      actions: (
        <>
          <Button size="sm" variant="outline"><Filter /> Filter</Button>
          <Button size="sm">New</Button>
        </>
      ),
    },
  },
  {
    id: "long-description",
    note: "Long description — capped at max-w-xl, wraps below title.",
    props: {
      eyebrow: "ANALYTICS",
      title: "Insights",
      description:
        "A multi-sentence description used to verify wrapping behavior. It should clamp to max-w-xl and never push the eyebrow or title out of vertical alignment with the action cluster on the right.",
      actions: <Button size="sm" variant="outline"><Download /> Export</Button>,
    },
  },
  {
    id: "everything-long",
    note: "All slots maxed — eyebrow + title + description + 4 actions.",
    props: {
      eyebrow: "DELIVERABLES · CLIENT VIEW · ARCHIVED",
      title: "Quarterly Deliverables Across Every Active Engagement",
      description:
        "Every slot stress-tested simultaneously. Actions cluster must remain right-aligned with the title baseline; description wraps below without touching the buttons.",
      actions: (
        <>
          <Button size="sm" variant="ghost"><RefreshCw /></Button>
          <Button size="sm" variant="outline"><Filter /> Filter</Button>
          <Button size="sm" variant="outline"><Download /> Export</Button>
          <Button size="sm"><Plus /> New</Button>
        </>
      ),
    },
  },
  {
    id: "many-actions",
    note: "5 actions, short title.",
    props: {
      eyebrow: "TASKS",
      title: "Pipeline",
      actions: (
        <>
          <Button size="sm" variant="ghost"><Settings /></Button>
          <Button size="sm" variant="ghost"><RefreshCw /></Button>
          <Button size="sm" variant="outline"><Filter /></Button>
          <Button size="sm" variant="outline"><Download /></Button>
          <Button size="sm"><Plus /> New</Button>
        </>
      ),
    },
  },
  {
    id: "icon-only-action",
    note: "Single icon-only action.",
    props: {
      eyebrow: "AGENTS",
      title: "Roster",
      description: "Icon-only buttons must align to the title baseline (items-end).",
      actions: <Button size="sm" variant="ghost"><Settings /></Button>,
    },
  },
  {
    id: "empty-fragment-actions",
    note: "Actions = empty fragment — must render IDENTICAL to no-actions case (no phantom gap).",
    props: {
      eyebrow: "EDGE",
      title: "Empty Actions",
      description: "Hardened guard should suppress the wrapper div entirely.",
      actions: <>{false && <Button size="sm">Hidden</Button>}</>,
    },
  },
];

export default function DevPageHeader() {
  return (
    <Layout>
      <div className="space-y-10 pb-16">
        <div className="space-y-1">
          <p className="text-[10px] text-mono uppercase tracking-[0.25em] text-muted-foreground/70">
            DEV · VISUAL HARNESS
          </p>
          <h1 className="text-display text-2xl font-semibold leading-none">
            PageHeader stress matrix
          </h1>
          <p className="text-[12.5px] text-muted-foreground max-w-xl">
            Each row renders the same `PageHeader` component with different inputs.
            Use this route to verify alignment is invariant across edge cases.
          </p>
        </div>

        {cases.map((c) => (
          <section key={c.id} className="space-y-2">
            <p className="text-[9.5px] text-mono uppercase tracking-[0.22em] text-muted-foreground/60">
              {c.id} — {c.note}
            </p>
            <div className="surface-1 p-6 rounded-xl">
              <PageHeader {...c.props} />
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
