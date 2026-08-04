import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Boxes, CheckCircle2, CircleDot,
  FileWarning, Globe2, IdCard, LayoutDashboard, Package, Plus, ShieldCheck,
  TrendingUp, Truck, Users, Warehouse as WarehouseIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/masters/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardInsights } from "@/hooks/useMasters";
import type { MasterTable } from "@/lib/masters.api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "MDM Dashboard — Meridia ERP Master Data" },
    { name: "description", content: "Enterprise master data governance dashboard with live quality, compliance and operational insights." },
    { property: "og:title", content: "MDM Dashboard — Meridia ERP" },
    { property: "og:description", content: "Live enterprise master data quality, compliance and activity overview." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const stats = [
  { label: "Suppliers", key: "suppliers", icon: Truck, to: "/suppliers" },
  { label: "Customers", key: "customers", icon: Users, to: "/customers" },
  { label: "Items", key: "items", icon: Package, to: "/items" },
  { label: "Warehouses", key: "warehouses", icon: WarehouseIcon, to: "/warehouses" },
  { label: "Employees", key: "employees", icon: IdCard, to: "/employees" },
  { label: "Vehicles", key: "vehicles", icon: Boxes, to: "/vehicles" },
  { label: "Countries", key: "countries", icon: Globe2, to: "/geography" },
] as const;

const quickActions = [
  { label: "New Supplier", to: "/suppliers", icon: Truck },
  { label: "New Customer", to: "/customers", icon: Users },
  { label: "New Item", to: "/items", icon: Package },
  { label: "New Warehouse", to: "/warehouses", icon: WarehouseIcon },
  { label: "New Employee", to: "/employees", icon: IdCard },
] as const;

const tableRoutes: Record<MasterTable, "/suppliers" | "/customers" | "/items" | "/warehouses" | "/employees" | "/vehicles" | "/geography"> = {
  suppliers: "/suppliers", customers: "/customers", items: "/items", warehouses: "/warehouses",
  employees: "/employees", carriers: "/vehicles", vehicles: "/vehicles", countries: "/geography",
};

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function Dashboard() {
  const { data, isLoading } = useDashboardInsights();
  const q = data?.quality;

  return (
    <div className="min-h-full">
      <PageHeader
        crumbs={[{ label: "Master Data Management", to: "/" }, { label: "Dashboard" }]}
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Master Data Dashboard"
        description="Single source of truth for reference data used across Warehouse, Inventory, Procurement, Manufacturing, Logistics and Finance."
        actions={<>
          <Button variant="outline" size="sm" asChild><Link to="/data-quality"><TrendingUp className="h-4 w-4" /> Data quality report</Link></Button>
          <Button size="sm" asChild className="shadow-[var(--shadow-primary)]"><Link to="/suppliers"><Plus className="h-4 w-4" /> New master record</Link></Button>
        </>}
      />

      <div className="space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" aria-label="Master data KPIs">
          {stats.map((stat) => (
            <Link key={stat.key} to={stat.to} className="surface-panel group cursor-pointer p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-elevated)]">
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><stat.icon className="h-4 w-4" /></div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {isLoading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="num mt-3 text-2xl font-semibold">{data?.counts[stat.key].toLocaleString() ?? 0}</p>}
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{stat.label}</p>
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                {(data?.cardDetails[stat.key] ?? ["Loading insights…"]).map((detail, index) => (
                  <li key={detail} className={cn("text-[11px] leading-4", index === 0 ? "font-medium text-success" : "text-muted-foreground")}>{detail}</li>
                ))}
              </ul>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
          <Link to="/data-quality" className="surface-panel group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-elevated)]">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Overall Data Quality Score</p><p className="mt-1 text-xs text-muted-foreground">Completeness, compliance and approval health</p></div><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div>
            <div className="mt-5 grid grid-cols-[112px_1fr] items-center gap-5">
              <div className="relative grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${(q?.score ?? 0) * 3.6}deg, var(--color-muted) 0deg)` }}><div className="grid h-20 w-20 place-items-center rounded-full bg-card"><span className="num text-xl font-semibold">{q?.score ?? 0}%</span></div></div>
              <dl className="space-y-2.5 text-xs">
                <Metric icon={CheckCircle2} label="Complete Records" value={q?.complete ?? 0} tone="success" />
                <Metric icon={AlertTriangle} label="Missing Mandatory Fields" value={data?.issues.filter((i) => i.issueType === "Missing Mandatory Field").length ?? 0} tone="warning" />
                <Metric icon={AlertTriangle} label="Duplicate Records" value={q?.duplicates ?? 0} tone="warning" />
                <Metric icon={FileWarning} label="Expired Documents" value={q?.expiredDocuments ?? 0} tone="destructive" />
                <Metric icon={CircleDot} label="Pending Approval" value={q?.pendingApprovals ?? 0} tone="primary" />
              </dl>
            </div>
          </Link>

          <Card><CardHeader className="border-b border-border pb-3"><CardTitle className="text-sm font-semibold">Data quality by module</CardTitle></CardHeader><CardContent className="pt-5"><div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.moduleQuality ?? []} margin={{ left: -24, right: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" /><XAxis dataKey="module" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} /><RTooltip cursor={{ fill: "var(--color-primary-soft)" }} /><Bar dataKey="score" fill="var(--color-chart-1)" radius={[5, 5, 0, 0]} maxBarSize={30} /></BarChart></ResponsiveContainer></div></CardContent></Card>

          <Card><CardHeader className="border-b border-border pb-3"><CardTitle className="text-sm font-semibold">Quick alerts</CardTitle></CardHeader><CardContent className="p-0"><ul className="divide-y divide-border">
            {(data?.alerts ?? []).map((alert) => <li key={alert.id}><Link to={tableRoutes[alert.table]} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-soft"><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", alert.tone === "critical" ? "bg-destructive/10 text-destructive" : alert.tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-primary-soft text-primary")}><AlertTriangle className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-xs font-medium leading-5">{alert.label}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link></li>)}
            {!data?.alerts.length && <li className="px-4 py-8 text-center text-xs text-muted-foreground"><ShieldCheck className="mx-auto mb-2 h-6 w-6 text-success" />No urgent alerts</li>}
          </ul></CardContent></Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
          <Card><CardHeader className="border-b border-border pb-3"><CardTitle className="text-sm font-semibold">Quick actions</CardTitle></CardHeader><CardContent className="grid gap-2 pt-4">{quickActions.map((action) => <Link key={action.label} to={action.to} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"><action.icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 truncate text-sm font-medium">{action.label}</span><Plus className="h-4 w-4 text-muted-foreground" /></Link>)}</CardContent></Card>
          <Card><CardHeader className="flex-row items-center justify-between border-b border-border pb-3"><CardTitle className="text-sm font-semibold">Recent activity</CardTitle><Badge variant="secondary">Live audit trail</Badge></CardHeader><CardContent className="p-0"><ul className="divide-y divide-border">
            {(data?.activity ?? []).slice(0, 6).map((activity) => <li key={activity.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3"><Avatar className="h-9 w-9"><AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{activity.initials}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2"><p className="truncate text-sm font-semibold">{activity.userName}</p><span className="text-xs text-muted-foreground">{activity.module}</span></div><p className="truncate text-xs text-muted-foreground"><span className="capitalize">{activity.action}</span> {activity.recordName} · {relativeTime(activity.created_at)}</p></div><Badge variant={activity.status === "Removed" ? "destructive" : "secondary"}>{activity.status}</Badge></li>)}
            {!data?.activity.length && <li className="px-5 py-10 text-center text-sm text-muted-foreground">No recorded activity yet.</li>}
          </ul></CardContent></Card>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: number; tone: "success" | "warning" | "destructive" | "primary" }) {
  return <div className="flex items-center gap-2"><Icon className={cn("h-3.5 w-3.5", tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : tone === "destructive" ? "text-destructive" : "text-primary")} /><dt className="min-w-0 flex-1 truncate text-muted-foreground">{label}</dt><dd className="num font-semibold text-foreground">{value}</dd></div>;
}