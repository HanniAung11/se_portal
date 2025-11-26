import { getTodayDate } from "./dateUtils";

// Time parsing helpers
export function parseSlotStartDate(slotId, dateStr) {
  // slotId examples: "8-9am", "10-11am", "Locker 1"
  if (!slotId) return null;
  if (/locker/i.test(slotId)) return null; // no time info

  // find am/pm
  const sufMatch = slotId.match(/(am|pm)/i);
  const suffix = sufMatch ? sufMatch[1].toLowerCase() : null;

  const startPart = slotId.split("-")[0];
  const numMatch = startPart.match(/(\d{1,2})/);
  if (!numMatch) return null;
  let hour = parseInt(numMatch[1], 10);

  if (suffix === "pm" && hour < 12) {
    hour += 12;
  }
  if (suffix === "am" && hour === 12) {
    hour = 0;
  }

  // build date
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d, hour, 0, 0, 0);
  return dt;
}

export function isSlotInFuture(slotId, dateStr) {
  const start = parseSlotStartDate(slotId, dateStr);
  if (!start) return true; // treat lockers or unknown as available
  const now = new Date();
  // if date is today, filter out slots that start before next full hour
  const selectedDate = new Date(dateStr + "T00:00:00");
  const today = new Date();
  if (
    selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate() === today.getDate()
  ) {
    const nextHour = new Date(now);
    if (nextHour.getMinutes() > 0 || nextHour.getSeconds() > 0) {
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    }
    // latest allowed start is 22 (10pm)
    if (start.getHours() > 22) return false;
    return start >= nextHour;
  }
  // for future dates, also cap to latest 22
  if (start.getHours && start.getHours() > 22) return false;
  return start >= now || start.getTime() === start.getTime();
}

export function isBookingInPast(booking) {
  if (!booking || !booking.booking_date || !booking.time_slot) return false;
  const start = parseSlotStartDate(booking.time_slot, booking.booking_date);
  if (!start) return false; // lockers or no time -> not considered past
  const now = new Date();
  return start < now;
}

// Generate hourly slots dynamically for a room and date.
// For today: start from the next full hour (if now is 14:18 -> start 15) up to 22 (10pm start).
// For future dates: start at 9 and go to 22.
export function generateHourlySlots(roomKey, dateStr, roomsData) {
  const room = roomsData[roomKey];
  if (!room) return [];

  // Lockers: return the existing locker objects directly
  if (roomKey === "locker") {
    return room.timeSlots.map((s) => ({ locker: s.locker }));
  }

  const todayStr = getTodayDate();
  const now = new Date();
  let startHour = 9; // default for future days
  if (dateStr === todayStr) {
    startHour = now.getHours();
    if (now.getMinutes() > 0 || now.getSeconds() > 0) startHour = startHour + 1;
    // allow starting earlier than 9 if today (user requested next nearest hour for today)
  }

  const slots = [];
  const lastStart = 22; // 22 -> 10pm start (10-11pm)

  for (let h = startHour; h <= lastStart; h++) {
    if (h > 23) break;
    // generate display numbers in 12-hour format
    const displayStart = ((h + 11) % 12) + 1; // maps 0->12,1->1,...,12->12
    const displayEnd = ((h + 1 + 11) % 12) + 1;
    const suffix = h + 1 >= 12 ? "pm" : "am"; // place suffix at the end as original
    const label = `${displayStart}-${displayEnd}${suffix}`;
    slots.push({ time: label });
  }

  return slots;
}

