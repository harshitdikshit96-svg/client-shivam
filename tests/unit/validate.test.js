// Field formats (lib/validate.js): what can be typed, and what is accepted on save.
import { describe, it, expect } from "vitest";
import { sanitize, checkValue, inputProps } from "@/lib/validate";

describe("while typing", () => {
  it("number-only fields drop everything that is not a digit and stop at their length", () => {
    expect(sanitize("aadhaar", "1234 5678 9012 34ab")).toBe("123456789012");
    expect(sanitize("mobile", "+91 98765-43210")).toBe("9198765432");
    expect(sanitize("pincode", "226 010x")).toBe("226010");
    expect(sanitize("bankAc", "0001-2345-6789")).toBe("000123456789");
  });
  it("codes become capitals without spaces", () => {
    expect(sanitize("pan", "abcde 1234f")).toBe("ABCDE1234F");
    expect(sanitize("ifsc", "sbin0001234")).toBe("SBIN0001234");
  });
  it("amounts keep digits and one decimal point", () => {
    expect(sanitize("money", "₹1,250.50.3")).toBe("1250.503");
    expect(sanitize("int", "8 hrs")).toBe("8");
  });
  it("input attributes bring up the number pad and limit the length", () => {
    expect(inputProps("aadhaar")).toMatchObject({ maxLength: 12, inputMode: "numeric", placeholder: "12 digits" });
    expect(inputProps("money")).toMatchObject({ inputMode: "decimal" });
  });
});

describe("on save", () => {
  const ok = (f, v) => expect(checkValue(f, v), `${f} ${v}`).toBeNull();
  const no = (f, v) => expect(checkValue(f, v), `${f} ${v}`).toMatch(/^Should be/);
  it("Aadhaar: exactly 12 digits", () => { ok("aadhaar", "123412341234"); no("aadhaar", "12341234123"); no("aadhaar", "12341234123a"); });
  it("mobile: 10 digits starting 6-9", () => { ok("mobile", "9876543210"); no("mobile", "5876543210"); no("mobile", "987654321"); });
  it("pincode: 6 digits, not starting 0", () => { ok("pincode", "226010"); no("pincode", "026010"); });
  it("PAN, GSTIN, IFSC", () => {
    ok("pan", "ABCDE1234F"); no("pan", "ABCD12345F");
    ok("gstin", "09ABCDE1234F1Z5"); no("gstin", "09ABCDE1234F1X5");
    ok("ifsc", "SBIN0001234"); no("ifsc", "SBIN1001234");
  });
  it("bank account 9-18 digits, ESIC IP 10, ESIC code 17", () => {
    ok("bankAc", "123456789"); no("bankAc", "12345678");
    ok("esicIp", "1234567890"); no("esicIp", "123456789");
    ok("esicCode", "12345678901234567"); no("esicCode", "1234");
  });
  it("names: letters, spaces, . ' - only", () => { ok("personName", "Ram D'Souza-Kumar Jr."); no("personName", "R4m"); no("personName", "Ram!"); });
  it("email and phone-or-email contact", () => {
    ok("email", "a@b.in"); no("email", "a@b");
    ok("contact", "0374 2800123"); ok("contact", "pe@coal.in"); no("contact", "call me");
  });
  it("amounts: ≥ 0, at most 2 decimals; per day wage more than 0", () => {
    ok("money", "0"); ok("money", "1250.5"); no("money", "12.345"); no("money", "-1");
    no("positiveMoney", "0"); ok("positiveMoney", "556");
  });
  it("percent 0-100; real calendar dates only", () => {
    ok("percent", "0.75"); no("percent", "101");
    ok("date", "2026-02-28"); no("date", "2026-02-30"); no("date", "1800-01-01");
  });
  it("length limits always apply", () => {
    expect(checkValue("text", "x".repeat(201))).toMatch(/at most 200/);
    expect(checkValue("code", "A".repeat(33), { max: 32 })).toMatch(/at most 32/);
  });
  it("blank is fine here (required is checked separately)", () => ok("aadhaar", ""));
});

describe("CSV downloads (Download Excel / FORM A)", async () => {
  const { csvCell } = await import("@/components/Data");
  it("a value that Excel would run as a formula is kept as text", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("numbers (also negative) and plain text are unchanged; commas and quotes are quoted", () => {
    expect(csvCell("-250.50")).toBe("-250.50");
    expect(csvCell(12613)).toBe("12613");
    expect(csvCell("Ramesh, Kumar")).toBe("\"Ramesh, Kumar\"");
    expect(csvCell(null)).toBe("");
  });
});
