// Room Data
export const roomsData = {
  meeting: {
    name: "Meeting Room",
    rules: "You can book up to 2 hours per session.",
    timeSlots: [
      { time: "8-9am" },
      { time: "9-10am" },
      { time: "10-11am" },
      { time: "11-12pm" },
    ],
  },
  locker: {
    name: "Locker",
    rules: "No time limitation. Lockers available.",
    timeSlots: [{ locker: 1 }, { locker: 2 }, { locker: 3 }],
  },
  kitchen: {
    name: "Kitchen",
    rules: "Can book for 1 hour per session.",
    timeSlots: [
      { time: "8-9am" },
      { time: "9-10am" },
      { time: "10-11am" },
      { time: "11-12pm" },
    ],
  },
};

