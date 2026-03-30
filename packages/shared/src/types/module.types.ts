/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

export enum ModuleType {
  FREECAB = "FREECAB",
  FREEDRIVE = "FREEDRIVE",
  FREECARGO = "FREECARGO",
  FREERUN = "FREERUN",
  FREESHUTTLE = "FREESHUTTLE"
}

export enum VehicleType {
  SEDAN = "SEDAN",
  VAN = "VAN",
  DAMAS = "DAMAS",
  LABO = "LABO",
  TRUCK_1TON = "TRUCK_1TON",
  TRUCK_2_5TON = "TRUCK_2_5TON",
  MOTORCYCLE = "MOTORCYCLE",
  BICYCLE = "BICYCLE",
  ANY = "ANY"
}

export type FareType = "METER" | "ZONE" | "DISTANCE" | "FIXED";

export interface ModuleConfig {
  enabled: boolean;
  label: string;
  icon: string;
  vehicleTypes: VehicleType[];
  fareType: FareType;
  multiStop: boolean;
  requiresVehicleInfo: boolean;
  taxInvoice: boolean;
}
