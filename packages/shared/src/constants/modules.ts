/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { ModuleConfig, ModuleType, VehicleType } from "../types/module.types.js";

export const MODULE_CONFIG: Record<ModuleType, ModuleConfig> = {
  [ModuleType.FREECAB]: {
    enabled: true,
    label: "Taxi",
    icon: "CAB",
    vehicleTypes: [VehicleType.SEDAN, VehicleType.VAN],
    fareType: "METER",
    multiStop: false,
    requiresVehicleInfo: false,
    taxInvoice: false
  },
  [ModuleType.FREEDRIVE]: {
    enabled: true,
    label: "Drive",
    icon: "DRIVE",
    vehicleTypes: [VehicleType.ANY],
    fareType: "ZONE",
    multiStop: false,
    requiresVehicleInfo: true,
    taxInvoice: false
  },
  [ModuleType.FREECARGO]: {
    enabled: true,
    label: "Cargo",
    icon: "CARGO",
    vehicleTypes: [VehicleType.DAMAS, VehicleType.LABO, VehicleType.TRUCK_1TON],
    fareType: "DISTANCE",
    multiStop: true,
    requiresVehicleInfo: false,
    taxInvoice: true
  },
  [ModuleType.FREERUN]: {
    enabled: true,
    label: "Errand",
    icon: "RUN",
    vehicleTypes: [VehicleType.MOTORCYCLE, VehicleType.BICYCLE],
    fareType: "DISTANCE",
    multiStop: true,
    requiresVehicleInfo: false,
    taxInvoice: false
  },
  [ModuleType.FREESHUTTLE]: {
    enabled: false,
    label: "Shuttle",
    icon: "SHUTTLE",
    vehicleTypes: [VehicleType.VAN],
    fareType: "FIXED",
    multiStop: true,
    requiresVehicleInfo: false,
    taxInvoice: false
  }
};
