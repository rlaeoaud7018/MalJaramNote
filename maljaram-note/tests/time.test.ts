import { describe, expect, it } from "vitest";
import { ageInYears, kstSlot, todayKst, weekRange } from "@/lib/time";

describe("KST 날짜 계산", () => {
  it("UTC 15시는 KST 다음 날 0시", () => {
    expect(todayKst(new Date("2026-12-07T14:59:59Z"))).toBe("2026-12-07");
    expect(todayKst(new Date("2026-12-07T15:00:00Z"))).toBe("2026-12-08");
  });

  it("이번 주·지난 주는 월~일", () => {
    // 2026-12-10(목) KST
    const now = new Date("2026-12-10T03:00:00Z");
    expect(weekRange("this_week", now)).toEqual({ from: "2026-12-07", to: "2026-12-13" });
    expect(weekRange("last_week", now)).toEqual({ from: "2026-11-30", to: "2026-12-06" });
    expect(weekRange("all", now)).toBeNull();
  });

  it("일요일 밤도 그 주에 포함", () => {
    // 2026-12-13(일) 23:30 KST
    expect(weekRange("this_week", new Date("2026-12-13T14:30:00Z"))).toEqual({ from: "2026-12-07", to: "2026-12-13" });
  });

  it("Cron 슬롯은 30분 단위로 내림", () => {
    expect(kstSlot(new Date("2026-12-08T11:00:40Z"))).toBe("20:00");
    expect(kstSlot(new Date("2026-12-08T11:29:59Z"))).toBe("20:00");
    expect(kstSlot(new Date("2026-12-08T11:30:05Z"))).toBe("20:30");
  });

  it("만 나이", () => {
    const now = new Date("2026-12-08T00:00:00Z");
    expect(ageInYears("2022-05", now)).toBe(4);
    expect(ageInYears("2014-12", now)).toBe(12);
    expect(ageInYears("2013-11", now)).toBe(13);
  });
});
