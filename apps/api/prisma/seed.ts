import { PrismaClient } from "@prisma/client";
import { ModuleType } from "@iwootcall/shared";
import { buildDevSeedPlan } from "../src/core/seed/dev-seed.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const plan = buildDevSeedPlan([
    ModuleType.FREECAB,
    ModuleType.FREEDRIVE,
    ModuleType.FREECARGO,
    ModuleType.FREERUN
  ]);

  const customer = await prisma.customer.upsert({
    where: {
      phone: plan.customer.phone
    },
    update: {
      name: plan.customer.name,
      elderlyMode: plan.customer.elderlyMode
    },
    create: {
      phone: plan.customer.phone,
      name: plan.customer.name,
      elderlyMode: plan.customer.elderlyMode
    }
  });

  for (const vehicle of plan.customer.vehicles) {
    await prisma.customerVehicle.upsert({
      where: {
        id: `${customer.id}:${vehicle.carNumber}`
      },
      update: {
        label: vehicle.label,
        carNumber: vehicle.carNumber,
        carModel: vehicle.carModel,
        isDefault: vehicle.isDefault
      },
      create: {
        id: `${customer.id}:${vehicle.carNumber}`,
        customerId: customer.id,
        label: vehicle.label,
        carNumber: vehicle.carNumber,
        carModel: vehicle.carModel,
        isDefault: vehicle.isDefault
      }
    });
  }

  for (const favorite of plan.customer.favorites) {
    await prisma.favorite.upsert({
      where: {
        id: `${customer.id}:${favorite.label.toLowerCase()}`
      },
      update: {
        label: favorite.label,
        lat: favorite.lat,
        lng: favorite.lng,
        address: favorite.address
      },
      create: {
        id: `${customer.id}:${favorite.label.toLowerCase()}`,
        customerId: customer.id,
        label: favorite.label,
        lat: favorite.lat,
        lng: favorite.lng,
        address: favorite.address
      }
    });
  }

  for (const worker of plan.workers) {
    await prisma.worker.upsert({
      where: {
        phone: worker.phone
      },
      update: {
        name: worker.name,
        module: worker.module,
        vehicleType: worker.vehicleType,
        vehicleNumber: worker.vehicleNumber,
        status: worker.status,
        isOnline: worker.isOnline,
        lat: worker.lat,
        lng: worker.lng,
        lastSeenAt: new Date()
      },
      create: {
        phone: worker.phone,
        name: worker.name,
        module: worker.module,
        vehicleType: worker.vehicleType,
        vehicleNumber: worker.vehicleNumber,
        status: worker.status,
        isOnline: worker.isOnline,
        lat: worker.lat,
        lng: worker.lng,
        lastSeenAt: new Date()
      }
    });
  }

  console.info("Seed completed");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
