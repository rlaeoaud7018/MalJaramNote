import { check, notFound, one, type Client } from "./types";

export type Child = { id: string; nickname: string; birthMonth: string | null; therapyType: string; centerName: string | null };
type Row = { id: string; nickname: string; birth_month: string | null; therapy_type: string; center_name: string | null };
const COLS = "id, nickname, birth_month, therapy_type, center_name";

const toChild = (r: Row): Child => ({
  id: r.id,
  nickname: r.nickname,
  birthMonth: r.birth_month ? r.birth_month.slice(0, 7) : null,
  therapyType: r.therapy_type,
  centerName: r.center_name,
});

export type ChildInput = { nickname?: string; birthMonth?: string | null; therapyType?: string; centerName?: string | null };

function toRow(c: ChildInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (c.nickname !== undefined) row.nickname = c.nickname;
  if (c.birthMonth !== undefined) row.birth_month = c.birthMonth ? `${c.birthMonth}-01` : null;
  if (c.therapyType !== undefined) row.therapy_type = c.therapyType;
  if (c.centerName !== undefined) row.center_name = c.centerName || null;
  return row;
}

export class ChildRepo {
  constructor(private db: Client) {}

  async countByUser(userId: string): Promise<number> {
    const r = await this.db.from("children").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (r.error) check(r, "children.count");
    return r.count ?? 0;
  }

  async create(userId: string, c: ChildInput): Promise<Child> {
    const r = await this.db.from("children").insert({ ...toRow(c), user_id: userId }).select(COLS).single();
    return toChild(one(r, "children.create"));
  }

  async update(id: string, c: ChildInput): Promise<Child> {
    const r = await this.db.from("children").update(toRow(c)).eq("id", id).select(COLS).maybeSingle();
    return toChild(check(r, "children.update") ?? notFound("CHILD_NOT_FOUND"));
  }

  // RLS로 본인 아이만 보인다. MVP는 1명
  async first(): Promise<Child | null> {
    const r = await this.db.from("children").select(COLS).order("created_at").limit(1).maybeSingle();
    const row = check(r, "children.first");
    return row ? toChild(row) : null;
  }

  async get(id: string): Promise<Child> {
    const r = await this.db.from("children").select(COLS).eq("id", id).maybeSingle();
    return toChild(check(r, "children.get") ?? notFound("CHILD_NOT_FOUND"));
  }
}
