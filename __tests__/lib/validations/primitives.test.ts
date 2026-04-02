import { describe, it, expect } from "vitest";
import {
  SHORT_ID_REGEX,
  ORDER_ID_REGEX,
  URL_REGEX,
  ISO_DATETIME_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  PASSWORD_REGEX,
  PASSWORD_REQUIREMENTS,
} from "@/lib/validations/primitives";

describe("SHORT_ID_REGEX", () => {
  it("matches 7 alphanumeric characters", () => {
    expect(SHORT_ID_REGEX.test("AbCd123")).toBe(true);
    expect(SHORT_ID_REGEX.test("0000000")).toBe(true);
    expect(SHORT_ID_REGEX.test("zzzzzzz")).toBe(true);
  });

  it("rejects invalid short IDs", () => {
    expect(SHORT_ID_REGEX.test("123456")).toBe(false);
    expect(SHORT_ID_REGEX.test("12345678")).toBe(false);
    expect(SHORT_ID_REGEX.test("abc-def")).toBe(false);
    expect(SHORT_ID_REGEX.test("")).toBe(false);
  });
});

describe("ORDER_ID_REGEX", () => {
  it("matches ORD followed by 7 alphanumeric", () => {
    expect(ORDER_ID_REGEX.test("ORDAbCd123")).toBe(true);
    expect(ORDER_ID_REGEX.test("ORD0000000")).toBe(true);
  });

  it("rejects missing ORD prefix", () => {
    expect(ORDER_ID_REGEX.test("AbCd123")).toBe(false);
    expect(ORDER_ID_REGEX.test("ord0000000")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(ORDER_ID_REGEX.test("ORD12345")).toBe(false);
    expect(ORDER_ID_REGEX.test("ORD123456789")).toBe(false);
  });
});

describe("URL_REGEX", () => {
  it("matches http and https URLs", () => {
    expect(URL_REGEX.test("https://example.com")).toBe(true);
    expect(URL_REGEX.test("http://localhost:3000")).toBe(true);
    expect(URL_REGEX.test("https://sub.domain.com/path?q=1")).toBe(true);
  });

  it("rejects non-http URLs", () => {
    expect(URL_REGEX.test("ftp://example.com")).toBe(false);
    expect(URL_REGEX.test("example.com")).toBe(false);
    expect(URL_REGEX.test("")).toBe(false);
  });
});

describe("ISO_DATETIME_REGEX", () => {
  it("matches ISO 8601 datetimes", () => {
    expect(ISO_DATETIME_REGEX.test("2024-01-15T10:30:00Z")).toBe(true);
    expect(ISO_DATETIME_REGEX.test("2024-01-15T10:30:00.000Z")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(ISO_DATETIME_REGEX.test("2024-01-15")).toBe(false);
    expect(ISO_DATETIME_REGEX.test("2024-01-15 10:30:00")).toBe(false);
    expect(ISO_DATETIME_REGEX.test("not-a-date")).toBe(false);
  });
});

describe("EMAIL_REGEX", () => {
  it("matches valid emails", () => {
    expect(EMAIL_REGEX.test("user@example.com")).toBe(true);
    expect(EMAIL_REGEX.test("user+tag@domain.co.uk")).toBe(true);
    expect(EMAIL_REGEX.test("test.name@sub.domain.org")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(EMAIL_REGEX.test("@example.com")).toBe(false);
    expect(EMAIL_REGEX.test("user@")).toBe(false);
    expect(EMAIL_REGEX.test("not-an-email")).toBe(false);
    expect(EMAIL_REGEX.test("")).toBe(false);
  });
});

describe("PHONE_REGEX", () => {
  it("matches valid phone numbers", () => {
    expect(PHONE_REGEX.test("+12345678901")).toBe(true);
    expect(PHONE_REGEX.test("9876543210")).toBe(true);
    expect(PHONE_REGEX.test("+911234567890")).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    expect(PHONE_REGEX.test("12345")).toBe(false);
    expect(PHONE_REGEX.test("+0123456789")).toBe(false);
    expect(PHONE_REGEX.test("abc-def-ghij")).toBe(false);
    expect(PHONE_REGEX.test("")).toBe(false);
  });
});

describe("PASSWORD_REGEX", () => {
  it("matches valid passwords", () => {
    expect(PASSWORD_REGEX.test("StrongP@ss1")).toBe(true);
    expect(PASSWORD_REGEX.test("MyP4$$word!")).toBe(true);
  });

  it("rejects passwords missing requirements", () => {
    expect(PASSWORD_REGEX.test("short1!")).toBe(false);
    expect(PASSWORD_REGEX.test("nouppercase1!")).toBe(false);
    expect(PASSWORD_REGEX.test("NOLOWERCASE1!")).toBe(false);
    expect(PASSWORD_REGEX.test("NoNumbers!!")).toBe(false);
    expect(PASSWORD_REGEX.test("NoSpecial1abc")).toBe(false);
  });
});

describe("PASSWORD_REQUIREMENTS", () => {
  it("has 5 requirements", () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
  });

  it("each requirement has label and test function", () => {
    for (const req of PASSWORD_REQUIREMENTS) {
      expect(typeof req.label).toBe("string");
      expect(typeof req.test).toBe("function");
    }
  });

  it("8 characters requirement works correctly", () => {
    const req = PASSWORD_REQUIREMENTS[0];
    expect(req.test("1234567")).toBe(false);
    expect(req.test("12345678")).toBe(true);
  });

  it("uppercase requirement works correctly", () => {
    const req = PASSWORD_REQUIREMENTS[1];
    expect(req.test("abcdefgh")).toBe(false);
    expect(req.test("Abcdefgh")).toBe(true);
  });

  it("lowercase requirement works correctly", () => {
    const req = PASSWORD_REQUIREMENTS[2];
    expect(req.test("ABCDEFGH")).toBe(false);
    expect(req.test("ABCDEFGh")).toBe(true);
  });

  it("number requirement works correctly", () => {
    const req = PASSWORD_REQUIREMENTS[3];
    expect(req.test("abcdefgh")).toBe(false);
    expect(req.test("abcdefg1")).toBe(true);
  });

  it("special character requirement works correctly", () => {
    const req = PASSWORD_REQUIREMENTS[4];
    expect(req.test("abcdefg1")).toBe(false);
    expect(req.test("abcdefg!")).toBe(true);
  });
});
