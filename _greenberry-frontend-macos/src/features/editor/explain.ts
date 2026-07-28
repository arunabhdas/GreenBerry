// Parse Postgres `EXPLAIN (FORMAT JSON)` into a plan tree with cost heat (S5.9).
export interface PlanNode {
  nodeType: string;
  totalCost: number;
  rows: number;
  heat: number; // totalCost / maxCost, 0..1
  children: PlanNode[];
}

type RawPlan = {
  "Node Type"?: string;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  Plans?: RawPlan[];
};

function maxTotalCost(plan: RawPlan): number {
  let max = plan["Total Cost"] ?? 0;
  for (const c of plan.Plans ?? []) max = Math.max(max, maxTotalCost(c));
  return max;
}

function build(plan: RawPlan, maxCost: number): PlanNode {
  const totalCost = plan["Total Cost"] ?? 0;
  return {
    nodeType: plan["Node Type"] ?? "Unknown",
    totalCost,
    rows: plan["Plan Rows"] ?? 0,
    heat: maxCost > 0 ? totalCost / maxCost : 0,
    children: (plan.Plans ?? []).map((c) => build(c, maxCost)),
  };
}

export function parseExplainJson(json: string | unknown): PlanNode {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  const first = Array.isArray(data) ? data[0] : data;
  const plan: RawPlan = (first?.Plan ?? first) as RawPlan;
  return build(plan, maxTotalCost(plan));
}
