

export function getSafeNext(search) {
  const params = new URLSearchParams(search);
  const next = params.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/dashboard";
}

describe("Auth 'next' redirect validation", () => {
  it("allows safe internal paths", () => {
    expect(getSafeNext("?next=/invite/abc123token")).toBe("/invite/abc123token");
    expect(getSafeNext("?next=/room/12345")).toBe("/room/12345");
  });

  it("rejects open redirect attacks and external links", () => {
    expect(getSafeNext("?next=//evil.com")).toBe("/dashboard");
    expect(getSafeNext("?next=https://evil.com")).toBe("/dashboard");
    expect(getSafeNext("?next=javascript:alert(1)")).toBe("/dashboard");
    expect(getSafeNext("")).toBe("/dashboard");
  });
});

