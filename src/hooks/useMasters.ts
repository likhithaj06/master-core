import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  counts,
  createRecord,
  deleteRecords,
  listAudit,
  listRecords,
  updateRecord,
  type MasterRecord,
  type MasterTable,
} from "@/lib/masters.api";

export function useMasterList(table: MasterTable) {
  return useQuery({
    queryKey: ["master", table],
    queryFn: () => listRecords(table),
    staleTime: 10_000,
  });
}

export function useSaveRecord(table: MasterTable, entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; values: Record<string, string> }) =>
      input.id ? updateRecord(table, input.id, input.values) : createRecord(table, input.values),
    onSuccess: (row, input) => {
      qc.invalidateQueries({ queryKey: ["master", table] });
      qc.invalidateQueries({ queryKey: ["master-counts"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      toast.success(input.id ? `${entity} updated` : `${entity} created`, {
        description: `${String(row.code)} saved to the master data database.`,
      });
    },
    onError: (e: Error) => toast.error("Could not save record", { description: e.message }),
  });
}

export function useDeleteRecords(table: MasterTable, entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteRecords(table, ids),
    onSuccess: (_d, ids) => {
      qc.invalidateQueries({ queryKey: ["master", table] });
      qc.invalidateQueries({ queryKey: ["master-counts"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      toast.success(
        ids.length > 1 ? `${ids.length} ${entity} records deleted` : `${entity} record deleted`,
      );
    },
    onError: (e: Error) => toast.error("Could not delete record", { description: e.message }),
  });
}

export function useMasterCounts() {
  return useQuery({ queryKey: ["master-counts"], queryFn: counts, staleTime: 10_000 });
}

export function useAudit(entity?: string, recordId?: string) {
  return useQuery({
    queryKey: ["audit", entity ?? "all", recordId ?? "all"],
    queryFn: () => listAudit(entity, recordId),
    staleTime: 10_000,
  });
}

export type { MasterRecord, MasterTable };
