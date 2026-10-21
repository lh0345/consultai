import { Database } from "../server/dist/database.js";
import { slotTimes } from "../server/dist/validation.js";

const db = new Database();
try {
  for (const subject of [
    { name: "Data Structures", code: "CS101", icon: "database" },
    { name: "Algorithms", code: "CS201", icon: "network" },
    { name: "Web Development", code: "CS301", icon: "code" },
  ])
    await db.subject.upsert({
      where: { code: subject.code },
      update: {},
      create: subject,
    });

  // Bootstrap a usable demonstration, once. The UI always reads the database.
  if ((await db.slot.count()) === 0) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Skopje",
    }).format(new Date());
    let day = new Date(`${today}T12:00:00Z`);
    for (let created = 0; created < 5;) {
      day = new Date(day.getTime() + 86400_000);
      if ([0, 6].includes(day.getUTCDay())) continue;
      const date = day.toISOString().slice(0, 10);
      for (const start of [
        "09:00",
        "09:30",
        "10:00",
        "10:30",
        "11:00",
        "11:30",
        "14:00",
        "14:30",
      ]) {
        await db.slot.create({
          data: slotTimes({ date, startTime: start, duration: 30 }),
        });
      }
      created++;
    }
  }
  console.log(
    "Demo subjects and future availability are saved. No bookings or integration connections were seeded.",
  );
} finally {
  await db.$disconnect();
}
