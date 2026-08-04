import { supabase } from "@/integrations/supabase/client";

export type MasterTable =
  | "suppliers"
  | "customers"
  | "items"
  | "warehouses"
  | "employees"
  | "carriers"
  | "vehicles"
  | "countries";

type FieldKind = "text" | "number" | "int" | "bool" | "array" | "status";

/** Column coercion map: form values arrive as strings, the database expects real types. */
const SCHEMA: Record<MasterTable, { prefix: string; fields: Record<string, FieldKind> }> = {
  suppliers: {
    prefix: "SUP",
    fields: { commodities: "array", status: "status" },
  },
  customers: {
    prefix: "CUS",
    fields: { deliveryLocations: "int", status: "status" },
  },
  items: {
    prefix: "ITM",
    fields: {
      cost: "number",
      price: "number",
      minStock: "int",
      maxStock: "int",
      reorderLevel: "int",
      status: "status",
    },
  },
  warehouses: {
    prefix: "WH",
    fields: { capacity: "int", utilization: "int", status: "status" },
  },
  employees: { prefix: "EMP", fields: { status: "status" } },
  carriers: {
    prefix: "CAR",
    fields: { refrigerated: "bool", hazardTransport: "bool", status: "status" },
  },
  vehicles: { prefix: "VEH", fields: { status: "status" } },
  countries: { prefix: "CTY", fields: { exchangeRate: "number", status: "status" } },
};

export type MasterRecord = Record<string, unknown> & { id: string; code: string };

function coerce(table: MasterTable, values: Record<string, string>) {
  const kinds = SCHEMA[table].fields;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined) continue;
    const kind = kinds[key] ?? "text";
    const v = typeof raw === "string" ? raw.trim() : raw;
    switch (kind) {
      case "int":
        out[key] = v === "" ? 0 : Math.round(Number(v)) || 0;
        break;
      case "number":
        out[key] = v === "" ? 0 : Number(v) || 0;
        break;
      case "bool":
        out[key] = v === "true" || v === "Yes" || v === "true";
        break;
      case "array":
        out[key] = String(v)
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "status":
        // the form uses a switch (true/false); lists use Active/Inactive/Draft
        out[key] = v === "true" ? "Active" : v === "false" ? "Inactive" : v || "Active";
        break;
      default:
        out[key] = v;
    }
  }
  return out;
}

export async function listRecords(table: MasterTable): Promise<MasterRecord[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MasterRecord[];
}

export async function getRecord(table: MasterTable, id: string): Promise<MasterRecord | null> {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as MasterRecord) ?? null;
}

export async function nextCode(table: MasterTable) {
  const { data } = await supabase
    .from(table)
    .select("code")
    .order("code", { ascending: false })
    .limit(1);
  const last = (data?.[0] as { code?: string } | undefined)?.code ?? "";
  const n = Number(last.replace(/\D/g, "")) || 1000;
  return `${SCHEMA[table].prefix}-${n + 1}`;
}

export async function createRecord(table: MasterTable, values: Record<string, string>) {
  const payload = coerce(table, values);
  if (!payload["code"]) payload["code"] = await nextCode(table);
  const { data: auth } = await supabase.auth.getUser();
  payload["created_by"] = auth.user?.id ?? null;
  const { data, error } = await supabase
    .from(table)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw friendly(error);
  return data as unknown as MasterRecord;
}

export async function updateRecord(
  table: MasterTable,
  id: string,
  values: Record<string, string>,
) {
  const payload = coerce(table, values);
  delete payload["created_by"];
  const { data, error } = await supabase
    .from(table)
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw friendly(error);
  return data as unknown as MasterRecord;
}

export async function deleteRecords(table: MasterTable, ids: string[]) {
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw friendly(error);
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505") return new Error("That code already exists — codes must be unique.");
  if (error.code === "42501")
    return new Error("You don't have permission for this action. Please sign in again.");
  return new Error(error.message);
}

/* ---------------- documents ---------------- */

export type DocumentRow = {
  id: string;
  entity: string;
  recordId: string | null;
  recordCode: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
  created_at: string;
};

export const BUCKET = "master-documents";

export async function uploadDocument(opts: {
  entity: string;
  recordId?: string | null;
  recordCode?: string | null;
  file: File;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("You must be signed in to upload documents.");
  if (opts.file.size > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");

  const safe = opts.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${opts.entity}/${crypto.randomUUID()}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, opts.file, { cacheControl: "3600", upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      entity: opts.entity,
      recordId: opts.recordId ?? null,
      recordCode: opts.recordCode ?? null,
      fileName: opts.file.name,
      filePath: path,
      fileSize: opts.file.size,
      mimeType: opts.file.type,
      uploadedBy: userId,
    } as never)
    .select()
    .single();
  if (error) throw friendly(error);
  return data as unknown as DocumentRow;
}

export async function listDocuments(entity: string, recordId?: string | null) {
  let q = supabase
    .from("documents")
    .select("*")
    .eq("entity", entity)
    .order("created_at", { ascending: false });
  if (recordId) q = q.eq("recordId", recordId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as DocumentRow[];
}

export async function attachDocumentsToRecord(ids: string[], recordId: string, recordCode: string) {
  if (!ids.length) return;
  const { error } = await supabase
    .from("documents")
    .update({ recordId, recordCode } as never)
    .in("id", ids);
  if (error) throw friendly(error);
}

export async function documentUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteDocument(doc: { id: string; filePath: string }) {
  await supabase.storage.from(BUCKET).remove([doc.filePath]);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw friendly(error);
}

/* ---------------- audit ---------------- */

export type AuditRow = {
  id: string;
  entity: string;
  recordId: string | null;
  recordCode: string | null;
  action: string;
  actor: string | null;
  created_at: string;
};

export async function listAudit(entity?: string, recordId?: string) {
  let q = supabase
    .from("audit_logs")
    .select("id, entity, recordId, recordCode, action, actor, created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  if (entity) q = q.eq("entity", entity);
  if (recordId) q = q.eq("recordId", recordId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AuditRow[];
}

export async function counts() {
  const tables: MasterTable[] = [
    "suppliers",
    "customers",
    "items",
    "warehouses",
    "employees",
    "carriers",
    "vehicles",
    "countries",
  ];
  const entries = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      return [t, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<MasterTable, number>;
}

/* ---------------- dashboard intelligence ---------------- */

export type QualityIssue = {
  id: string;
  module: string;
  table: MasterTable;
  recordId: string;
  recordCode: string;
  recordName: string;
  issueType: "Missing Mandatory Field" | "Duplicate Record" | "Expired Certification" | "Expired Document" | "Pending Approval" | "Inactive Record";
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Review";
  assignedTo: string;
  lastUpdated: string;
};

export type DashboardAlert = {
  id: string;
  label: string;
  table: MasterTable;
  recordId: string | null;
  tone: "critical" | "warning" | "info";
};

export type DashboardActivity = AuditRow & {
  userName: string;
  initials: string;
  module: string;
  recordName: string;
  status: string;
};

export type DashboardInsights = {
  counts: Record<MasterTable, number>;
  cardDetails: Record<MasterTable, string[]>;
  quality: {
    score: number;
    total: number;
    complete: number;
    incomplete: number;
    duplicates: number;
    expiredCertifications: number;
    expiredDocuments: number;
    pendingApprovals: number;
    inactive: number;
  };
  issues: QualityIssue[];
  alerts: DashboardAlert[];
  activity: DashboardActivity[];
  moduleQuality: Array<{ module: string; score: number; issues: number; duplicates: number; missing: number }>;
};

const MODULE_LABELS: Record<MasterTable, string> = {
  suppliers: "Supplier Master",
  customers: "Customer Master",
  items: "Item Master",
  warehouses: "Warehouse Master",
  employees: "Employee Master",
  carriers: "Carrier Master",
  vehicles: "Vehicle Master",
  countries: "Country & Currency",
};

const REQUIRED_FIELDS: Record<MasterTable, string[]> = {
  suppliers: ["code", "name", "contactPerson", "email", "country", "taxNumber"],
  customers: ["code", "name", "contactPerson", "email", "billingAddress", "country"],
  items: ["code", "name", "category", "unit", "sku"],
  warehouses: ["code", "name", "location", "manager"],
  employees: ["code", "name", "department", "designation", "email", "role"],
  carriers: ["code", "name", "contactPerson", "phone", "licenseNumber"],
  vehicles: ["code", "vehicleNumber", "type", "driver", "insuranceExpiry"],
  countries: ["code", "name", "currency", "taxRule", "timeZone"],
};

function asText(row: MasterRecord, key: string) {
  return String(row[key] ?? "").trim();
}

function displayName(table: MasterTable, row: MasterRecord) {
  return asText(row, "name") || asText(row, "vehicleNumber") || row.code;
}

function parseDate(value: unknown) {
  const time = Date.parse(String(value ?? ""));
  return Number.isNaN(time) ? null : time;
}

function daysFromNow(value: unknown) {
  const time = parseDate(value);
  return time === null ? null : Math.ceil((time - Date.now()) / 86_400_000);
}

function createdWithin(row: MasterRecord, days: number) {
  const time = parseDate(row["createdAt"] ?? row["created_at"]);
  return time !== null && time >= Date.now() - days * 86_400_000;
}

export async function dashboardInsights(): Promise<DashboardInsights> {
  const tables: MasterTable[] = [
    "suppliers", "customers", "items", "warehouses", "employees", "carriers", "vehicles", "countries",
  ];
  const [recordEntries, auditResult, profileResult, documentResult] = await Promise.all([
    Promise.all(tables.map(async (table) => [table, await listRecords(table)] as const)),
    supabase.from("audit_logs").select("id, entity, recordId, recordCode, action, actor, created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("profiles").select("id, fullName, email"),
    supabase.from("documents").select("id, entity, recordId, created_at"),
  ]);
  if (auditResult.error) throw auditResult.error;
  if (profileResult.error) throw profileResult.error;
  if (documentResult.error) throw documentResult.error;

  const records = Object.fromEntries(recordEntries) as Record<MasterTable, MasterRecord[]>;
  const countMap = Object.fromEntries(tables.map((table) => [table, records[table].length])) as Record<MasterTable, number>;
  const issues: QualityIssue[] = [];
  const addIssue = (table: MasterTable, row: MasterRecord, issueType: QualityIssue["issueType"], severity: QualityIssue["severity"]) => {
    issues.push({
      id: `${table}-${row.id}-${issueType}`,
      module: MODULE_LABELS[table], table, recordId: row.id, recordCode: row.code,
      recordName: displayName(table, row), issueType, severity,
      status: severity === "Critical" || severity === "High" ? "Open" : "In Review",
      assignedTo: issueType === "Pending Approval" ? "Department Manager" : "Data Steward",
      lastUpdated: String(row["updated_at"] ?? row["created_at"] ?? row["createdAt"] ?? ""),
    });
  };

  for (const table of tables) {
    const duplicateKeys = new Map<string, MasterRecord[]>();
    for (const row of records[table]) {
      const key = displayName(table, row).toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
      duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), row]);
      if (REQUIRED_FIELDS[table].some((field) => !asText(row, field) || asText(row, field) === "—")) {
        addIssue(table, row, "Missing Mandatory Field", "High");
      }
      if (asText(row, "status") === "Draft" || asText(row, "certification") === "Pending") {
        addIssue(table, row, "Pending Approval", "Medium");
      }
      if (asText(row, "status") === "Inactive") addIssue(table, row, "Inactive Record", "Low");
    }
    for (const matches of duplicateKeys.values()) {
      if (matches.length > 1) matches.forEach((row) => addIssue(table, row, "Duplicate Record", "High"));
    }
  }

  records.suppliers.forEach((row) => {
    const expired = asText(row, "certification") === "Expired" || (daysFromNow(row["certificationExpiry"]) ?? 1) < 0;
    if (expired) addIssue("suppliers", row, "Expired Certification", "Critical");
  });
  records.vehicles.forEach((row) => {
    if ((daysFromNow(row["insuranceExpiry"]) ?? 1) < 0 || (daysFromNow(row["fitnessExpiry"]) ?? 1) < 0) {
      addIssue("vehicles", row, "Expired Document", "Critical");
    }
  });

  const issueIds = new Set(issues.map((issue) => `${issue.table}:${issue.recordId}`));
  const total = tables.reduce((sum, table) => sum + records[table].length, 0);
  const incomplete = issueIds.size;
  const complete = Math.max(0, total - incomplete);
  const countIssue = (type: QualityIssue["issueType"]) => issues.filter((issue) => issue.issueType === type).length;
  const quality = {
    score: total ? Math.round((complete / total) * 1000) / 10 : 100,
    total, complete, incomplete,
    duplicates: countIssue("Duplicate Record"),
    expiredCertifications: countIssue("Expired Certification"),
    expiredDocuments: countIssue("Expired Document"),
    pendingApprovals: countIssue("Pending Approval"),
    inactive: countIssue("Inactive Record"),
  };

  const documentsByRecord = new Set((documentResult.data ?? []).map((doc) => `${doc.entity}:${doc.recordId}`));
  const supplierExpiry = records.suppliers.filter((row) => {
    const days = daysFromNow(row["certificationExpiry"]);
    return days !== null && days >= 0 && days <= 60;
  });
  const vehicleExpiry = records.vehicles.filter((row) => {
    const days = daysFromNow(row["insuranceExpiry"]);
    return days !== null && days >= 0 && days <= 60;
  });
  const nearCapacity = records.warehouses.filter((row) => Number(row["utilization"] ?? 0) >= 85);
  const roleApproval = records.employees.filter((row) => !asText(row, "role") || /pending/i.test(asText(row, "role")));
  const staleCurrency = records.countries.filter((row) => Number(row["exchangeRate"] ?? 0) <= 0);
  const hazardMissingSds = records.items.filter((row) => asText(row, "hazard") !== "None" && !documentsByRecord.has(`items:${row.id}`));
  const alerts: DashboardAlert[] = [
    { id: "supplier-cert", label: `${supplierExpiry.length} supplier certifications expiring`, table: "suppliers", recordId: supplierExpiry[0]?.id ?? null, tone: "warning" },
    { id: "vehicle-insurance", label: `${vehicleExpiry.length} vehicles need insurance renewal`, table: "vehicles", recordId: vehicleExpiry[0]?.id ?? null, tone: "critical" },
    { id: "warehouse-capacity", label: `${nearCapacity.length} warehouses near capacity`, table: "warehouses", recordId: nearCapacity[0]?.id ?? null, tone: "warning" },
    { id: "employee-role", label: `${roleApproval.length} employees awaiting role approval`, table: "employees", recordId: roleApproval[0]?.id ?? null, tone: "info" },
    { id: "currency-update", label: `${staleCurrency.length} currency exchange rates need update`, table: "countries", recordId: staleCurrency[0]?.id ?? null, tone: "info" },
    { id: "hazard-sds", label: `${hazardMissingSds.length} hazardous items missing SDS`, table: "items", recordId: hazardMissingSds[0]?.id ?? null, tone: "critical" },
  ].filter((alert) => !alert.label.startsWith("0 ")) as DashboardAlert[];

  const profiles = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile]));
  const allRecords = new Map<string, MasterRecord>();
  tables.forEach((table) => records[table].forEach((row) => allRecords.set(`${table}:${row.id}`, row)));
  const activity = ((auditResult.data ?? []) as unknown as AuditRow[]).map((audit) => {
    const profile = audit.actor ? profiles.get(audit.actor) : null;
    const userName = profile?.fullName || profile?.email || "System user";
    const words = userName.split(/\s+/).filter(Boolean);
    return {
      ...audit,
      userName,
      initials: words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "SU",
      module: MODULE_LABELS[audit.entity as MasterTable] ?? audit.entity,
      recordName: displayName(audit.entity as MasterTable, allRecords.get(`${audit.entity}:${audit.recordId}`) ?? { id: audit.recordId ?? "", code: audit.recordCode ?? "Record" }),
      status: audit.action === "create" ? "Approved" : audit.action === "delete" ? "Removed" : "Updated",
    };
  });

  const averageUtilization = records.warehouses.length
    ? Math.round(records.warehouses.reduce((sum, row) => sum + Number(row["utilization"] ?? 0), 0) / records.warehouses.length)
    : 0;
  const activePct = (table: MasterTable) => countMap[table]
    ? Math.round((records[table].filter((row) => asText(row, "status") === "Active").length / countMap[table]) * 100)
    : 100;
  const cardDetails: Record<MasterTable, string[]> = {
    suppliers: [`+${records.suppliers.filter((row) => createdWithin(row, 7)).length} added this week`, `${records.suppliers.filter((row) => asText(row, "certification") === "Pending").length} pending approval`, `${supplierExpiry.length} certifications expiring`],
    customers: [`+${records.customers.filter((row) => createdWithin(row, 30)).length} added this month`, `${records.customers.filter((row) => asText(row, "status") === "Inactive").length} inactive customers`, `${activePct("customers")}% active`],
    items: [`+${records.items.filter((row) => createdWithin(row, 30)).length} new items`, `${records.items.filter((row) => Number(row["reorderLevel"] ?? 0) > 0).length} reorder policies defined`, `${hazardMissingSds.length} hazardous items missing SDS`],
    warehouses: [`${averageUtilization}% average utilization`, `${nearCapacity.length} near capacity`, `${records.warehouses.filter((row) => asText(row, "status") === "Inactive").length} unavailable`],
    employees: [`+${records.employees.filter((row) => createdWithin(row, 30)).length} new employees`, `${roleApproval.length} pending role approval`, `${activePct("employees")}% active`],
    carriers: [`${activePct("carriers")}% active carriers`, `${records.carriers.filter((row) => Boolean(row["refrigerated"])).length} refrigerated`, `${records.carriers.filter((row) => Boolean(row["hazardTransport"])).length} hazmat certified`],
    vehicles: [`${vehicleExpiry.length} insurance renewals due`, `${records.vehicles.filter((row) => asText(row, "status") === "Inactive").length} unavailable`, `${records.vehicles.filter((row) => asText(row, "status") === "Active").length} available vehicles`],
    countries: [`${records.countries.filter((row) => createdWithin(row, 30)).length} updated this month`, `${staleCurrency.length} exchange rate issues`, `${activePct("countries")}% active`],
  };

  const moduleQuality = tables.filter((table) => table !== "carriers").map((table) => {
    const moduleIssues = issues.filter((issue) => issue.table === table);
    const affected = new Set(moduleIssues.map((issue) => issue.recordId)).size;
    return {
      module: MODULE_LABELS[table].replace(" Master", ""),
      score: countMap[table] ? Math.round(((countMap[table] - affected) / countMap[table]) * 1000) / 10 : 100,
      issues: moduleIssues.length,
      duplicates: moduleIssues.filter((issue) => issue.issueType === "Duplicate Record").length,
      missing: moduleIssues.filter((issue) => issue.issueType === "Missing Mandatory Field").length,
    };
  });

  return { counts: countMap, cardDetails, quality, issues, alerts, activity, moduleQuality };
}
