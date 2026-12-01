// FNC-A-008: 업로드 실패에 대비해 녹음 파일을 IndexedDB에 보관하고, 다시 올리기를 제공한다
const DB_NAME = "maljaram";
const STORE = "pending-uploads";

export type PendingUpload = { key: string; blob: Blob; fileName: string; sessionDate: string; childId: string; createdAt: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

type CreateResponse = { sessionId: string; upload: { path: string; signedUrl: string; expiresIn: number } };

export class UploadQueue {
  async enqueue(item: Omit<PendingUpload, "key" | "createdAt">): Promise<string> {
    const key = crypto.randomUUID();
    await tx("readwrite", (s) => s.put({ ...item, key, createdAt: Date.now() }));
    return key;
  }

  list(): Promise<PendingUpload[]> {
    return tx("readonly", (s) => s.getAll() as IDBRequest<PendingUpload[]>);
  }

  async remove(key: string): Promise<void> {
    await tx("readwrite", (s) => s.delete(key));
  }

  // 회기 생성 → Signed URL로 직접 업로드(진행률) → 처리 시작. 성공하면 보관본 삭제
  async upload(item: PendingUpload, onProgress: (pct: number) => void): Promise<string> {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: item.childId,
        sessionDate: item.sessionDate,
        consentConfirmed: true,
        fileName: item.fileName,
        fileSize: item.blob.size,
        mimeType: item.blob.type || "audio/webm",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new UploadError(res.status, body?.error?.code, body?.error?.message);
    const { sessionId, upload } = body as CreateResponse;

    await putWithProgress(upload.signedUrl, item.blob, onProgress);
    const p = await fetch(`/api/sessions/${sessionId}/process`, { method: "POST" });
    if (!p.ok && p.status !== 409) throw new UploadError(p.status, "PROCESS_FAILED");
    await this.remove(item.key);
    return sessionId;
  }

  // 남아 있는 보관본을 차례로 다시 올린다. 마지막으로 성공한 회기 ID를 돌려준다
  async retryAll(onProgress: (pct: number) => void): Promise<string | null> {
    let last: string | null = null;
    for (const item of await this.list()) last = await this.upload(item, onProgress);
    return last;
  }
}

export class UploadError extends Error {
  constructor(public status: number, public code?: string, message?: string) {
    super(message ?? "업로드하지 못했어요. 네트워크를 확인하고 다시 올려 주세요.");
  }
}

// Supabase Signed Upload URL은 PUT으로 올린다. fetch는 업로드 진행률을 주지 않아 XHR 사용
function putWithProgress(url: string, blob: Blob, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", blob.type || "audio/webm");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new UploadError(xhr.status, "STORAGE_ERROR")));
    xhr.onerror = () => reject(new UploadError(0, "NETWORK"));
    xhr.send(blob);
  });
}
