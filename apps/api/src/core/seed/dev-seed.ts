import { ModuleType, VehicleType } from "@iwootcall/shared";

export interface DevSeedPlan {
  customer: {
    phone: string;
    name: string;
    elderlyMode: boolean;
    vehicles: Array<{
      label: string;
      carNumber: string;
      carModel: string;
      isDefault: boolean;
    }>;
    favorites: Array<{
      label: string;
      lat: number;
      lng: number;
      address: string;
    }>;
  };
  workers: Array<{
    phone: string;
    name: string;
    module: ModuleType;
    vehicleType: VehicleType;
    vehicleNumber: string;
    status: "ACTIVE";
    isOnline: boolean;
    lat: number;
    lng: number;
  }>;
}

export function buildDevSeedPlan(enabledModules: ModuleType[]): DevSeedPlan {
  return {
    customer: {
      phone: "01099990001",
      name: "Demo Customer",
      elderlyMode: false,
      vehicles: [
        {
          label: "Primary Car",
          carNumber: "12A3456",
          carModel: "Sonata",
          isDefault: true
        }
      ],
      favorites: [
        {
          label: "Home",
          lat: 37.5551,
          lng: 126.9707,
          address: "Seoul Station"
        },
        {
          label: "Office",
          lat: 37.5663,
          lng: 126.9779,
          address: "Seoul City Hall"
        }
      ]
    },
    workers: enabledModules.map((module, index) => ({
      phone: `0109999001${index + 1}`,
      name: `${module} Demo Worker`,
      module,
      vehicleType: seedVehicleType(module),
      vehicleNumber: `99A10${index + 1}`,
      status: "ACTIVE" as const,
      isOnline: true,
      lat: 37.55 + index * 0.01,
      lng: 126.97 + index * 0.01
    }))
  };
}

function seedVehicleType(module: ModuleType): VehicleType {
  switch (module) {
    case ModuleType.FREECAB:
      return VehicleType.SEDAN;
    case ModuleType.FREEDRIVE:
      return VehicleType.ANY;
    case ModuleType.FREECARGO:
      return VehicleType.TRUCK_1TON;
    case ModuleType.FREERUN:
      return VehicleType.MOTORCYCLE;
    case ModuleType.FREESHUTTLE:
      return VehicleType.VAN;
  }
}
