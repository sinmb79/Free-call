/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { SignJWT, jwtVerify } from "jose";
import type { AccessTokenClaims } from "../core/auth/types.js";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(
  claims: AccessTokenClaims,
  secret: string
): Promise<string> {
  return new SignJWT({
    phone: claims.phone,
    role: claims.role,
    module: claims.module
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret));

  return {
    sub: String(payload.sub),
    role: payload.role as AccessTokenClaims["role"],
    phone: String(payload.phone),
    module: payload.module as AccessTokenClaims["module"]
  };
}
