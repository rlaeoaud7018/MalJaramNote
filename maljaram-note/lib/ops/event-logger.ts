import { EventRepo } from "@/lib/repo/event-repo";
import type { Client } from "@/lib/repo/types";
import { ApiError } from "@/lib/validation/api-error";
import { EVENT_NAMES } from "@/lib/validation/schemas";

// FNC-O-001: 허용된 7종만 기록. props에는 ID만 넣는다
export class EventLogger {
  constructor(private db: Client) {}

  async log(userId: string, name: string, props: Record<string, unknown> = {}): Promise<void> {
    if (!(EVENT_NAMES as readonly string[]).includes(name)) throw new ApiError(400, "UNKNOWN_EVENT");
    await new EventRepo(this.db).insert(userId, name, props);
  }
}
