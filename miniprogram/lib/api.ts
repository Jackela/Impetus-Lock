import { API_ORIGIN } from "./config";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface Session { token: string; subject: string }
let session: Session | undefined;
let login: Promise<string> | undefined;
let generation = 0;
let serial = 0;

export function requestId(): string {
  serial += 1;
  return [Date.now().toString(36), serial.toString(36), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)].join("-");
}

export function currentSubject(): string {
  return session?.subject ?? "";
}

export function invalidateSession(): void {
  generation += 1;
  session = undefined;
  login = undefined;
}

function changedIdentity(): ApiError {
  return new ApiError(401, "微信身份需要重新确认，请重试。");
}

function errorText(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const payload = data as {message?: unknown; error?: {code?: string; message?: unknown}};
    if (payload.error?.code === "VALIDATION_ERROR") return "填写的内容不符合要求，请检查后重试。";
    const message = payload.error?.message ?? payload.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as {detail: unknown}).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail.map(item => typeof item?.msg === "string" ? item.msg : "").filter(Boolean);
      if (messages.length) return messages.join("；");
    }
  }
  const fallback: Record<number, string> = {
    401: "微信会话已过期，请重试。",
    403: "当前身份或局内规则不允许此操作。",
    404: "内容不存在或已撤回。",
    409: "内容已变更，请核对最新版本。",
    422: "请检查提交的内容。",
    429: "请求过于频繁，请稍后重试。",
    502: "故事服务暂时不可用，请稍后重试。",
  };
  return fallback[status] ?? "服务暂时无法完成这次操作，请重试。";
}

function request<T>(path: string, method: Method, data?: unknown, token?: string): Promise<T> {
  if (!API_ORIGIN) {
    return Promise.reject(new ApiError(0, "尚未配置故事服务地址，请联系小程序维护者。"));
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_ORIGIN + "/api/wechat" + path,
      // The native transport supports PUT. The API exposes PUT and PATCH for saving works.
      method: method === "PATCH" ? "PUT" : method,
      data: data as WechatMiniprogram.RequestOption["data"],
      timeout: 60000,
      header: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data as T);
        else reject(new ApiError(res.statusCode, errorText(res.data, res.statusCode)));
      },
      fail() { reject(new ApiError(0, "网络连接中断，请核对结果后重试。")); },
    });
  });
}

export function ensureSession(): Promise<string> {
  if (session) return Promise.resolve(session.subject);
  if (login) return login;
  const epoch = generation;
  const task = new Promise<string>((resolve, reject) => {
    wx.login({
      timeout: 10000,
      success(result) {
        if (result.code) resolve(result.code);
        else reject(changedIdentity());
      },
      fail() { reject(new ApiError(401, "微信身份确认失败，请重试。")); },
    });
  }).then(async code => {
    if (generation !== epoch) throw changedIdentity();
    const result = await request<Session>("/session", "POST", {code});
    if (generation !== epoch) throw changedIdentity();
    if (!result || typeof result.token !== "string" || !result.token
        || typeof result.subject !== "string" || !result.subject) throw changedIdentity();
    session = { token: result.token, subject: result.subject };
    return result.subject;
  }).finally(() => { if (generation === epoch) login = undefined; });
  login = task;
  return task;
}

export async function api<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  if (!path.startsWith("/") || path.includes("..") || path.includes("//")) throw new ApiError(400, "请求路径无效。");
  if (method === "GET" && /^\/cards\/[A-Za-z0-9_%.-]+$/.test(path)) return request<T>(path, method);
  const epoch = generation;
  await ensureSession();
  if (generation !== epoch || !session) throw changedIdentity();
  try {
    const result = await request<T>(path, method, body, session.token);
    if (generation !== epoch) throw changedIdentity();
    return result;
  } catch (error) {
    if (generation !== epoch) throw changedIdentity();
    if (error instanceof ApiError && error.status === 401) invalidateSession();
    throw error;
  }
}
