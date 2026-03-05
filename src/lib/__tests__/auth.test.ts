import { test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSet } = vi.hoisted(() => ({ mockSet: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockSet }),
}));

const { mockSetProtectedHeader, mockSetExpirationTime, mockSign } =
  vi.hoisted(() => ({
    mockSetProtectedHeader: vi.fn(),
    mockSetExpirationTime: vi.fn(),
    mockSign: vi.fn().mockResolvedValue("mock-token"),
  }));

vi.mock("jose", () => ({
  SignJWT: vi.fn((payload: unknown) => ({
    _payload: payload,
    setProtectedHeader: mockSetProtectedHeader.mockReturnThis(),
    setExpirationTime: mockSetExpirationTime.mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: mockSign,
  })),
}));

import { createSession } from "../auth";

beforeEach(() => vi.clearAllMocks());

test("sets cookie with correct name and token", async () => {
  await createSession("user-1", "user@example.com");
  expect(mockSet).toHaveBeenCalledWith(
    "auth-token",
    "mock-token",
    expect.any(Object)
  );
});

test("sets httpOnly and sameSite options", async () => {
  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
});

test("sets secure: false outside production", async () => {
  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.secure).toBe(false);
});

test("sets expires ~7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const options = mockSet.mock.calls[0][2];
  const expires: Date = options.expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("sets cookie path to /", async () => {
  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.path).toBe("/");
});

test("sets secure: true in production", async () => {
  const original = process.env.NODE_ENV;
  vi.stubEnv("NODE_ENV", "production");
  await createSession("user-1", "user@example.com");
  const options = mockSet.mock.calls[0][2];
  expect(options.secure).toBe(true);
  vi.unstubAllEnvs();
});

test("signs JWT with HS256 algorithm", async () => {
  await createSession("user-1", "user@example.com");
  expect(mockSetProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
});

test("signs JWT with expiration of 7d", async () => {
  await createSession("user-1", "user@example.com");
  expect(mockSetExpirationTime).toHaveBeenCalledWith("7d");
});

test("includes userId and email in JWT payload", async () => {
  const { SignJWT } = await import("jose");
  await createSession("user-1", "user@example.com");
  const payload = vi.mocked(SignJWT).mock.calls[0][0] as Record<string, unknown>;
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});
