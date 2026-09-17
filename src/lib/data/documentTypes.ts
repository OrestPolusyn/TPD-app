import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentCode } from "@/lib/matching/types";

export interface DocumentTypeRow {
  code: DocumentCode;
  label_uk: string;
  label_es: string;
  sort_order: number;
}

export async function getActiveDocumentTypes(supabase: SupabaseClient): Promise<DocumentTypeRow[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select("code, label_uk, label_es, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentTypeRow[];
}
