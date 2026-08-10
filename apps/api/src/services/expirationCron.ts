import cron from "node-cron";
import { prisma } from "@ml-ims/db";

/**
 * Marks Active lots as Quarantined at 00:00 on their expiration date.
 * Runs every minute locally so demo environments still catch expirations;
 * production schedule is midnight via CRON_SCHEDULE env.
 */
export async function quarantineExpiredLots(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.inventoryLot.updateMany({
    where: {
      status: "Active",
      expirationDate: { lte: today },
    },
    data: {
      status: "Quarantined",
    },
  });

  if (result.count > 0) {
    console.log(`[cron] Quarantined ${result.count} expired lot(s)`);
  }
  return result.count;
}

export function startExpirationCron() {
  // Default: run at 00:00 every day. Override with CRON_SCHEDULE.
  const schedule = process.env.CRON_SCHEDULE ?? "0 0 * * *";
  if (!cron.validate(schedule)) {
    console.warn(`[cron] Invalid CRON_SCHEDULE="${schedule}", skipping scheduler`);
    return;
  }

  cron.schedule(schedule, () => {
    void quarantineExpiredLots().catch((err) => {
      console.error("[cron] Expiration job failed", err);
    });
  });

  // Also run once on boot so restarted services catch up.
  void quarantineExpiredLots().catch((err) => {
    console.error("[cron] Startup expiration sweep failed", err);
  });

  console.log(`[cron] Expiration quarantine scheduled: ${schedule}`);
}
