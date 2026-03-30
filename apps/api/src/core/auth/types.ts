/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { ModuleType, VehicleType } from "@iwootcall/shared";

export type WorkerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type AuthRole = "worker" | "customer" | "admin";

export interface WorkerRecord {
  id: string;
  phone: string;
  name: string;
  fcmToken: string | null;
  module: ModuleType;
  vehicleType: VehicleType;
  vehicleNumber: string;
  status: WorkerStatus;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  phone: string;
  name: string;
  fcmToken: string | null;
  elderlyMode: boolean;
  createdAt: string;
}

export interface CustomerFavoriteRecord {
  id: string;
  customerId: string;
  label: string;
  lat: number;
  lng: number;
  address: string;
  createdAt: string;
}

export interface CustomerVehicleRecord {
  id: string;
  customerId: string;
  label: string;
  carNumber: string;
  carModel: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface WorkerRegistrationInput {
  phone: string;
  name: string;
  module: ModuleType;
  vehicleType: VehicleType;
  vehicleNumber: string;
  otpCode: string;
}

export interface WorkerLoginInput {
  phone: string;
  otpCode: string;
}

export interface CustomerRegistrationInput {
  phone: string;
  name: string;
  otpCode: string;
}

export interface CustomerLoginInput {
  phone: string;
  otpCode: string;
}

export interface CustomerVehicleCreateInput {
  label: string;
  carNumber: string;
  carModel?: string;
  isDefault?: boolean;
}

export interface CustomerVehicleUpdateInput {
  label?: string;
  carNumber?: string;
  carModel?: string | null;
  isDefault?: boolean;
}

export interface CustomerProfileUpdateInput {
  name?: string;
  elderlyMode?: boolean;
}

export interface DeviceTokenUpdateInput {
  fcmToken: string | null;
}

export interface CustomerFavoriteCreateInput {
  label: string;
  lat: number;
  lng: number;
  address: string;
}

export interface CustomerFavoriteUpdateInput {
  label?: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export interface AccessTokenClaims {
  sub: string;
  role: AuthRole;
  phone: string;
  module?: ModuleType;
}
