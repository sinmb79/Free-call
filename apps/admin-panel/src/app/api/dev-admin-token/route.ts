import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const DEFAULT_PHONE = "01000000000";
const DEFAULT_SUBJECT = "admin-1";

export async function POST(request: Request) {
  const enabled =
    process.env.ADMIN_DEV_ENABLED === "true" ||
    process.env.NODE_ENV !== "production";

  if (!enabled) {
    return NextResponse.json(
      { message: "Dev admin token generation is disabled." },
      { status: 403 }
    );
  }

  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        message:
          "Missing ADMIN_JWT_SECRET. Set it in the admin-panel runtime environment."
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const phone = body.phone?.trim() || DEFAULT_PHONE;

  const token = await new SignJWT({
    phone,
    role: "admin"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(DEFAULT_SUBJECT)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({
    token,
    phone
  });
}
