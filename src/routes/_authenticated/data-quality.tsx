import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { PageHeader } from "@/components/masters/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboardInsights } from "@/hooks/useMasters";
import type { MasterTable, QualityIssue } from "@/lib/masters.api";

export const Route = createFileRoute("/_authenticated/data-quality")({
  head: () => ({ meta: [
    { title: "Data Quality Report — Meridia ERP" },
    { name: "description", content: "Master data completeness, duplicates, compliance, approvals and remediation report." },
    { property: "og:title", content: "Data Quality Report — Meridia ERP" },
    { property: "og:description", content: "Enterprise master data quality analysis and issue remediation report." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: DataQualityReport,
});

const routeForTable: Record<MasterTable, string> = {
  suppliers: "/suppliers", customers: "/customers", items: "/items", warehouses: "/warehouses",
  employees: "/employees", carriers: "/vehicles", vehicles: "/vehicles", countries: "/geography",
};

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

function csvRows(issues: QualityIssue[], separator = ",") {
  const rows = [["Module", "Record Code", "Record Name", "Issue Type", "Severity", "Status", "Assigned To", "Last Updated"], ...issues.map((i) => [i.module, i.recordCode, i.recordName, i.issueType, i.severity, i.status, i.assignedTo, i.lastUpdated])];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(separator)).join("\n");
}

function DataQualityReport() {
  const navigate = useNavigate();
  const { data, refetch, isFetching } = useDashboardInsights();
  const [module, setModule] = useState("all"); const [type, setType] = useState("all");
  const [severity, setSeverity] = useState("all"); const [status, setStatus] = useState("all"); const [date, setDate] = useState("");
  const issues = useMemo(() => (data?.issues ?? []).filter((issue) =>
    (module === "all" || issue.table === module) && (type === "all" || issue.issueType === type) &&
    (severity === "all" || issue.severity === severity) && (status === "all" || issue.status === status) &&
    (!date || issue.lastUpdated.slice(0, 10) === date)), [data, module, type, severity, status, date]);
  const q = data?.quality;
  const approvalData = [{ name: "Pending", value: q?.pendingApprovals ?? 0, fill: "var(--color-warning)" }, { name: "Complete", value: q?.complete ?? 0, fill: "var(--color-success)" }];

  const summary = [
    ["Overall Quality", `${q?.score ?? 0}%`], ["Complete Records", q?.complete ?? 0], ["Incomplete Records", q?.incomplete ?? 0],
    ["Duplicate Records", q?.duplicates ?? 0], ["Expired Certifications", q?.expiredCertifications ?? 0],
    ["Expired Documents", q?.expiredDocuments ?? 0], ["Pending Approvals", q?.pendingApprovals ?? 0], ["Inactive Records", q?.inactive ?? 0],
  ];

  return <div className="min-h-full">
    <PageHeader crumbs={[{ label: "Master Data Management", to: "/" }, { label: "Data Quality Report" }]} icon={<ShieldCheck className="h-5 w-5" />} title="Data Quality Report" description="Completeness, duplication, compliance and approval exceptions across all master modules." actions={<>
      <Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</Button>
      <Button variant="outline" size="sm" onClick={() => download("data-quality.csv", csvRows(issues), "text/csv")}><Download className="h-4 w-4" /> CSV</Button>
      <Button variant="outline" size="sm" onClick={() => download("data-quality.xls", csvRows(issues, "\t"), "application/vnd.ms-excel")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={() => { toast.info("Use Save as PDF in the print dialog"); window.print(); }}><FileText className="h-4 w-4" /> PDF</Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
    </>} />
    <div className="space-y-5 p-4 sm:p-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{summary.map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="num mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>)}</section>
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Data Quality by Module"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.moduleQuality ?? []}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" /><XAxis dataKey="module" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><RTooltip /><Bar dataKey="score" fill="var(--color-chart-1)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Duplicate Records by Module"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.moduleQuality ?? []}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" /><XAxis dataKey="module" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><RTooltip /><Bar dataKey="duplicates" fill="var(--color-chart-5)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Missing Mandatory Fields"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.moduleQuality ?? []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="module" width={85} tick={{ fontSize: 11 }} /><RTooltip /><Bar dataKey="missing" fill="var(--color-chart-4)" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Approval Status & Expired Documents"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={approvalData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} /><Legend /><RTooltip /></PieChart></ResponsiveContainer></ChartCard>
      </section>
      <Card>
        <CardHeader className="border-b border-border"><CardTitle className="text-sm font-semibold">Quality issues</CardTitle><div className="grid gap-2 pt-3 sm:grid-cols-2 lg:grid-cols-5"><FilterSelect value={module} onChange={setModule} label="Module" options={[...new Set((data?.issues ?? []).map((i) => i.table))]} /><FilterSelect value={type} onChange={setType} label="Issue Type" options={[...new Set((data?.issues ?? []).map((i) => i.issueType))]} /><FilterSelect value={severity} onChange={setSeverity} label="Severity" options={["Critical", "High", "Medium", "Low"]} /><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" aria-label="Date" /><FilterSelect value={status} onChange={setStatus} label="Status" options={["Open", "In Review"]} /></div></CardHeader>
        <CardContent className="p-0"><div className="overflow-auto"><Table><TableHeader><TableRow><TableHead>Module</TableHead><TableHead>Record code</TableHead><TableHead>Record name</TableHead><TableHead>Issue type</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Assigned to</TableHead><TableHead>Last updated</TableHead></TableRow></TableHeader><TableBody>{issues.map((issue) => <TableRow key={issue.id} className="cursor-pointer" onClick={() => navigate({ to: routeForTable[issue.table] })}><TableCell>{issue.module}</TableCell><TableCell className="num font-medium text-primary">{issue.recordCode}</TableCell><TableCell className="font-medium">{issue.recordName}</TableCell><TableCell>{issue.issueType}</TableCell><TableCell><Badge variant={issue.severity === "Critical" ? "destructive" : "secondary"}>{issue.severity}</Badge></TableCell><TableCell><Badge variant="outline">{issue.status}</Badge></TableCell><TableCell>{issue.assignedTo}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{issue.lastUpdated ? new Date(issue.lastUpdated).toLocaleDateString() : "—"}</TableCell></TableRow>)}{!issues.length && <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">No issues match the selected filters.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
      </Card>
    </div>
  </div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card><CardHeader className="border-b border-border pb-3"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader><CardContent className="h-[280px] pt-5">{children}</CardContent></Card>; }
function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) { return <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">All {label}</SelectItem>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>; }