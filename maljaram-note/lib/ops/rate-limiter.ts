import { EventRepo } from "@/lib/repo/event-repo";
import type { Client } from "@/lib/repo/types";
import { ApiError } from "@/lib/validation/api-error";

export const SESSION_QUOTA = 10;

// FNC-O-004: 보호자당 회기 10건. 삭제한 회기도 포함해야 하므로 sessions가 아니라
// 회기 생성 때 남기는 session_uploaded 이벤트(삭제되지 않음)를 센다. 관리자 클라이언트 필요
export class RateLimiter {
  constructor(private admin: Client) {}

  async assertQuota(userId: string): Promise<void> {
    const used = await new EventRepo(this.admin).countByUser(userId, "session_uploaded");
    if (used >= SESSION_QUOTA) throw new ApiError(429, "QUOTA_EXCEEDED");
  }
}
