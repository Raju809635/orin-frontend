import { api } from "@/lib/api";

export type DomainTreeResponse = {
  version: string;
  updatedAt: string;
  tree: Record<string, Record<string, string[]>>;
  primaryCategories: string[];
  subCategoriesByPrimary: Record<string, string[]>;
  focusByPrimarySub: Record<string, string[]>;
};

let cached: { at: number; data: DomainTreeResponse } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function getDomainTree(): Promise<DomainTreeResponse> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.data;
  const { data } = await api.get<DomainTreeResponse>("/api/meta/domain-tree");
  cached = { at: now, data };
  return data;
}

