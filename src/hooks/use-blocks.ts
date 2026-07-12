import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingBlock } from "@/lib/pilates";

export function useBlocks() {
  const [blocks, setBlocks] = useState<TrainingBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("training_blocks" as any)
      .select("*")
      .order("sort_order");
    setBlocks((data ?? []) as unknown as TrainingBlock[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byOrder = (n: number | null | undefined) =>
    n == null ? undefined : blocks.find((b) => b.sort_order === n);

  return { blocks, loading, reload: load, byOrder };
}
