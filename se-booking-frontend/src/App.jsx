import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./styles/index.css";

// API Configuration
// Use proxy in development (via Vite), direct URL as fallback
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "/api"  // Use Vite proxy in development
  : "http://localhost:8000";  // Direct URL in production

// EmailJS Configuration
const EMAIL_CONFIG = {
  publicKey: "0u3TvKABvdtKTkOC8",
  serviceID: "service_sq31cdj",
  templateID: "template_tlthlwi",
  adminEmail: "mnc9135@gmail.com",
};

// Load EmailJS
const loadEmailJS = () => {
  return new Promise((resolve, reject) => {
    if (window.emailjs) {
      resolve(window.emailjs);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
    script.onload = () => {
      window.emailjs.init(EMAIL_CONFIG.publicKey);
      resolve(window.emailjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Utility Functions
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDateDivider = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  }
};

const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

const escapeHtml = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// Email sending function
const sendBookingEmail = async (booking, type = "NEW BOOKING") => {
  try {
    const emailjs = await loadEmailJS();

    const templateParams = {
      to_email: EMAIL_CONFIG.adminEmail,
      from_name: "SE Booking System",
      booking_type: type,
      room_name: booking.room_name,
      student_name: booking.student_name,
      student_id: booking.student_id,
      booking_date: formatDate(booking.booking_date),
      time_slot: booking.time_slot,
      booking_details:
        type === "NEW BOOKING"
          ? "A new booking has been created."
          : "This booking has been cancelled by the student.",
    };

    await emailjs.send(
      EMAIL_CONFIG.serviceID,
      EMAIL_CONFIG.templateID,
      templateParams
    );

    return { success: true };
  } catch (error) {
    console.error("Email send failed:", error);
    return { success: false, error };
  }
};

// Send contact form email (uses a different EmailJS template)
const sendContactEmail = async (form) => {
  try {
    const emailjs = await loadEmailJS();

    const templateParams = {
      to_email: EMAIL_CONFIG.adminEmail,
      from_name: form.name || "Visitor",
      from_email: form.email || "",
      phone: form.phone || "",
      name: form.name,
      email: form.email,
      subject: form.subject || "Contact form submission",
      message: form.message || "",
    };

    // Use the contact-specific template id
    const contactTemplateId = "template_vvhyrnh";

    await emailjs.send(
      EMAIL_CONFIG.serviceID,
      contactTemplateId,
      templateParams
    );
    return { success: true };
  } catch (error) {
    console.error("Contact email send failed:", error);
    return { success: false, error };
  }
};

// Room Data
const roomsData = {
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

// --- Time parsing helpers ---
function parseSlotStartDate(slotId, dateStr) {
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

function isSlotInFuture(slotId, dateStr) {
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

function isBookingInPast(booking) {
  if (!booking || !booking.booking_date || !booking.time_slot) return false;
  const start = parseSlotStartDate(booking.time_slot, booking.booking_date);
  if (!start) return false; // lockers or no time -> not considered past
  const now = new Date();
  return start < now;
}

// Generate hourly slots dynamically for a room and date.
// For today: start from the next full hour (if now is 14:18 -> start 15) up to 22 (10pm start).
// For future dates: start at 9 and go to 22.
function generateHourlySlots(roomKey, dateStr) {
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

// Courses data for Curriculum page
const courses = [
  // Year 1 - Semester 1
  {
    year: 1,
    semester: 1,
    code: "1006710",
    title: "Introduction to Calculus",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn the fundamentals of calculus including limits, derivatives, and integrals.",
    img: "📐",
  },
  {
    year: 1,
    semester: 1,
    code: "1286111",
    title: "Circuits and Electronics",
    cls: "(3-3-8)",
    credits: 4,
    desc: "Study electronic components, circuit design, and analysis.",
    img: "🔌",
  },
  {
    year: 1,
    semester: 1,
    code: "1286120",
    title: "Elementary Systems Programming",
    cls: "(3-3-8)",
    credits: 4,
    desc: "Introduction to systems programming concepts, C programming, and memory management.",
    img: "💻",
  },
  {
    year: 1,
    semester: 1,
    code: "1286121",
    title: "Computer Programming",
    cls: "(3-3-8)",
    credits: 4,
    desc: "Learn programming fundamentals using Python, including loops, functions, and arrays.",
    img: "🐍",
  },
  {
    year: 1,
    semester: 1,
    code: "96641002",
    title: "Digital Intelligence Quotient",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Develop critical thinking and problem-solving skills in digital contexts.",
    img: "🧠",
  },
  {
    year: 1,
    semester: 1,
    code: "96642170",
    title: "Introduction to Logic",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn logic, reasoning, and proof techniques essential for computer science.",
    img: "🔢",
  },

  // Year 1 - Semester 2
  {
    year: 1,
    semester: 2,
    code: "13006008",
    title: "Calculus 2",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Continuation of calculus including integration techniques, series, and multivariable functions.",
    img: "📐",
  },
  {
    year: 1,
    semester: 2,
    code: "13006209",
    title: "Academic English 2",
    cls: "(3-2-7)",
    credits: 3,
    desc: "Improve academic reading, writing, and presentation skills in English.",
    img: "📝",
  },
  {
    year: 1,
    semester: 2,
    code: "96642012",
    title: "Design Thinking",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn the creative problem-solving methodology used in innovative projects.",
    img: "🎨",
  },
  {
    year: 1,
    semester: 2,
    code: "13016105",
    title: "Discrete Mathematics",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study logic, sets, combinatorics, and relations for computer science.",
    img: "📊",
  },
  {
    year: 1,
    semester: 2,
    code: "13016204",
    title: "Digital Circuit and Logic Design",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Understand digital circuits, gates, and logic design principles.",
    img: "⚡",
  },
  {
    year: 1,
    semester: 2,
    code: "13016205",
    title: "Digital Circuit Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Hands-on lab to implement digital circuits.",
    img: "🛠️",
  },
  {
    year: 1,
    semester: 2,
    code: "13016209",
    title: "Object-Oriented Concepts and Programming",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn OOP concepts such as classes, inheritance, and polymorphism.",
    img: "💻",
  },
  {
    year: 1,
    semester: 2,
    code: "13016210",
    title: "Object-Oriented Programming Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Hands-on lab to practice OOP programming.",
    img: "💻",
  },

  // Year 2 - Semester 1
  {
    year: 2,
    semester: 1,
    code: "13006006",
    title: "Linear Algebra",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn vectors, matrices, determinants, and linear transformations.",
    img: "➗",
  },
  {
    year: 2,
    semester: 1,
    code: "13006210",
    title: "Technical Writing",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Develop professional writing skills for technical documents.",
    img: "📝",
  },
  {
    year: 2,
    semester: 1,
    code: "13006403",
    title: "Business Administration",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Introduction to management, organizational behavior, and business fundamentals.",
    img: "🏢",
  },
  {
    year: 2,
    semester: 1,
    code: "13016207",
    title: "Computer Organization and Assembly Language",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Understand computer architecture and low-level programming in assembly.",
    img: "💻",
  },
  {
    year: 2,
    semester: 1,
    code: "13016208",
    title: "Computer Organization and Assembly Language Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Hands-on lab for assembly programming and architecture exercises.",
    img: "🛠️",
  },
  {
    year: 2,
    semester: 1,
    code: "13016212",
    title: "Data Structures and Algorithms",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn arrays, stacks, queues, trees, and algorithm design.",
    img: "📊",
  },
  {
    year: 2,
    semester: 1,
    code: "13016213",
    title: "Data Structures and Algorithms Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Lab to implement and practice data structures and algorithms.",
    img: "🛠️",
  },
  {
    year: 2,
    semester: 1,
    code: "13016249",
    title: "Advanced Object-Oriented Programming",
    cls: "(2-2-5)",
    credits: 3,
    desc: "Advanced topics in OOP including design patterns and best practices.",
    img: "💻",
  },

  // Year 2 - Semester 2
  {
    year: 2,
    semester: 2,
    code: "13006009",
    title: "Probability and Statistics",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study probability distributions, statistics, and data analysis.",
    img: "📈",
  },
  {
    year: 2,
    semester: 2,
    code: "13006211",
    title: "Technical Communication and Presentation",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn to communicate technical ideas effectively in writing and speech.",
    img: "🗣️",
  },
  {
    year: 2,
    semester: 2,
    code: "13016214",
    title: "Software Engineering Principles",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Introduction to SDLC, Agile methodology, and project management.",
    img: "🛠️",
  },
  {
    year: 2,
    semester: 2,
    code: "13016215",
    title: "Software Engineering Principles Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Hands-on lab for software engineering projects.",
    img: "🛠️",
  },
  {
    year: 2,
    semester: 2,
    code: "13016237",
    title: "Information Systems and Databases",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn relational databases, SQL, and information systems design.",
    img: "🗄️",
  },
  {
    year: 2,
    semester: 2,
    code: "13016239",
    title: "Algorithm Design and Analysis",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Design efficient algorithms and analyze their complexity.",
    img: "📊",
  },
  {
    year: 2,
    semester: 2,
    code: "13016241",
    title: "Computer Networks and Communications",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study networking concepts, TCP/IP, and routing.",
    img: "🌐",
  },
  {
    year: 2,
    semester: 2,
    code: "13016242",
    title: "Computer Networks and Communications Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Lab for network setup and analysis.",
    img: "🛠️",
  },
  {
    year: 2,
    semester: 2,
    code: "13016248",
    title: "Seminar in Software Engineering",
    cls: "(0-3-0)",
    credits: 0,
    desc: "Seminar and discussion on current software engineering topics.",
    img: "🎓",
  },

  // Year 3 - Semester 1
  {
    year: 3,
    semester: 1,
    code: "13016223",
    title: "Artificial Intelligence",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn AI concepts including search algorithms, knowledge representation, and reasoning.",
    img: "🤖",
  },
  {
    year: 3,
    semester: 1,
    code: "13016384",
    title: "Database Systems",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn database models, SQL, and transactions.",
    img: "🗄️",
  },
  {
    year: 3,
    semester: 1,
    code: "13016219",
    title: "Object-Oriented Analysis and Design",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Analyze and design software using OOP techniques.",
    img: "💻",
  },
  {
    year: 3,
    semester: 1,
    code: "13016220",
    title: "Object-Oriented Analysis and Design Laboratory",
    cls: "(0-3-2)",
    credits: 1,
    desc: "Lab to practice OOP analysis and design.",
    img: "🛠️",
  },
  {
    year: 3,
    semester: 1,
    code: "13016216",
    title: "Operating Systems",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study OS concepts including process management and memory.",
    img: "🖥️",
  },
  {
    year: 3,
    semester: 1,
    code: "13016240",
    title: "Theory of Computation",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study automata, formal languages, and computational theory.",
    img: "📜",
  },
  {
    year: 3,
    semester: 1,
    code: "13016344",
    title: "Web Programming",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn web development using HTML, CSS, and JavaScript.",
    img: "💻",
  },

  // Year 3 - Semester 2
  {
    year: 3,
    semester: 2,
    code: "13016226",
    title: "Compiler Construction",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn compiler design including lexical analysis, parsing, and code generation.",
    img: "⚙️",
  },
  {
    year: 3,
    semester: 2,
    code: "13016385",
    title: "Distributed Computing",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study distributed algorithms, systems, and synchronization.",
    img: "☁️",
  },
  {
    year: 3,
    semester: 2,
    code: "13016386",
    title: "Enterprise Software Development",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn large-scale software development and best practices.",
    img: "🏢",
  },
  {
    year: 3,
    semester: 2,
    code: "13016228",
    title: "Software Design and Architecture",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study software architecture patterns and design principles.",
    img: "🏗️",
  },
  {
    year: 3,
    semester: 2,
    code: "13016230",
    title: "Software Development Process",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Learn the software development lifecycle and methodologies.",
    img: "🛠️",
  },
  {
    year: 3,
    semester: 2,
    code: "13016294",
    title: "Team Software Project",
    cls: "(0-9-5)",
    credits: 3,
    desc: "Team-based software project integrating learned skills.",
    img: "👥",
  },

  // Year 4 - Semester 1
  {
    year: 4,
    semester: 1,
    code: "13______",
    title: "Free Elective",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Choose a course of your interest.",
    img: "🎓",
  },
  {
    year: 4,
    semester: 1,
    code: "13016243",
    title: "Human-Computer Interaction",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Study interface design and usability principles.",
    img: "🖱️",
  },
  {
    year: 4,
    semester: 1,
    code: "13016348",
    title: "Advanced Topics in Computer Networks",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Advanced study in networking and communication protocols.",
    img: "🌐",
  },
  {
    year: 4,
    semester: 1,
    code: "13016291",
    title: "Software Project 1",
    cls: "(0-9-5)",
    credits: 3,
    desc: "First part of a capstone software project.",
    img: "💻",
  },
  {
    year: 4,
    semester: 1,
    code: "13016224",
    title: "Software Verification and Validation",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Techniques for software testing and quality assurance.",
    img: "✔️",
  },

  // Year 4 - Semester 2
  {
    year: 4,
    semester: 2,
    code: "13006401",
    title: "Computer Ethics and Law",
    cls: "(0-24-12)",
    credits: 12,
    desc: "Study legal and ethical aspects of computing.",
    img: "⚖️",
  },
  {
    year: 4,
    semester: 2,
    code: "13______",
    title: "Free Elective",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Choose a course of your interest.",
    img: "🎓",
  },
  {
    year: 4,
    semester: 2,
    code: "13016348",
    title: "Advanced Topics in Computer Networks",
    cls: "(3-0-6)",
    credits: 3,
    desc: "Advanced study in networking and communication protocols.",
    img: "🌐",
  },
  {
    year: 4,
    semester: 2,
    code: "13016292",
    title: "Software Project 2",
    cls: "(0-9-5)",
    credits: 3,
    desc: "Second part of a capstone software project.",
    img: "💻",
  },
];

// Main App Component
export default function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem("authToken"));
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("about");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmailJS();
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    if (!authToken) {
      setCurrentPage("about");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
        setCurrentPage(user.role === "admin" ? "admin-dashboard" : "booking");
      } else {
        localStorage.removeItem("authToken");
        setAuthToken(null);
        setCurrentPage("about");
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setCurrentPage("about");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem("authToken", token);
    setCurrentPage(user.role === "admin" ? "admin-dashboard" : "booking");
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentPage("about");
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="app">
      {currentPage === "about" && (
        <AboutPage
          onSwitchToLogin={() => setCurrentPage("login")}
          onNavigate={(p) => setCurrentPage(p)}
        />
      )}
      {currentPage === "login" && (
        <LoginPage
          onLogin={handleLogin}
          onSwitchToSignup={() => setCurrentPage("signup")}
        />
      )}
      {currentPage === "signup" && (
        <SignupPage onSwitchToLogin={() => setCurrentPage("login")} />
      )}
      {currentPage === "booking" && (
        <BookingPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "yourBookings" && (
        <YourBookingsPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "chat" && (
        <ChatPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "curriculum" && (
        <CurriculumPage
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "gpa" && (
        <GPAPage
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "credit" && (
        <CreditsPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "contact" && (
        <ContactPage
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "admin-dashboard" && (
        <AdminDashboardPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "admin-registrations" && (
        <AdminRegistrationsPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "admin-grading" && (
        <AdminGradingPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "admin-courses" && (
        <AdminCoursesPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "admin-attendance" && (
        <AdminAttendancePage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "admin-chat" && (
        <AdminChatPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "profile" && (
        <ProfilePage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === "notifications" && (
        <NotificationsPage
          currentUser={currentUser}
          authToken={authToken}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      <Footer />
    </div>
  );
}

// About Page Component
function AboutPage({ onSwitchToLogin, onNavigate }) {
  useEffect(() => {
    // Counter animation
    const counters = document.querySelectorAll(".rating-number");
    counters.forEach((counter) => {
      let updateCount = () => {
        let target = +counter.getAttribute("data-target");
        let count = +counter.innerText;
        let increment = target / 200;
        if (count < target) {
          counter.innerText = Math.ceil(count + increment);
          setTimeout(updateCount, 15);
        } else {
          counter.innerText = target;
        }
      };
      updateCount();
    });
  }, []);

  return (
    <div className="about-page-container">
      <div className="about-content">
        <h1 className="about-title">Welcome to Software Engineering</h1>

        <section className="description-card-about">
          <p>
            Founded in 2001 to meet the growing demand for skilled software
            professionals in Thailand. Developed into a leading program
            emphasizing innovation, practical experience, and industry
            collaboration.
          </p>
        </section>

        <section className="ratings-section">
          <div className="rating-box">
            <span className="rating-number" data-target="1200">
              0
            </span>
            <span className="rating-title">World Ranking</span>
          </div>
          <div className="rating-box">
            <span className="rating-number" data-target="9">
              0
            </span>
            <span className="rating-title">Local Ranking</span>
          </div>
          <div className="rating-box">
            <span className="rating-number" data-target="15">
              0
            </span>
            <span className="rating-title">Major Ranking</span>
          </div>
        </section>

        <section className="contact-section-about">
          <p>Let's get in touch with Software Engineering</p>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button onClick={onSwitchToLogin} className="login-cta-btn">
              Login / Signup
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// Curriculum Page Component (converted from standalone HTML)
function CurriculumPage({ currentUser, onLogout, onNavigate }) {
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [currentCourses, setCurrentCourses] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadCourses();
  }, [selectedYear, selectedSemester]);

  useEffect(() => {
    // no window event listeners needed; navigation handled via Header/props
  }, [onNavigate]);

  function selectYear(y) {
    setSelectedYear(y);
  }

  function selectSemester(s) {
    setSelectedSemester(s);
  }

  function loadCourses() {
    const filtered = courses.filter(
      (c) => c.year === selectedYear && c.semester === selectedSemester
    );
    setCurrentCourses(filtered);
  }

  function openCurriculumModal(index) {
    setCurrentIndex(index);
    setModalOpen(true);
  }

  function closeCurriculumModal() {
    setModalOpen(false);
  }

  function prevCourse() {
    setCurrentIndex(
      (i) => (i - 1 + currentCourses.length) % currentCourses.length
    );
  }

  function nextCourse() {
    setCurrentIndex((i) => (i + 1) % currentCourses.length);
  }

  const course = currentCourses[currentIndex] || {};

  return (
    <div className="page-container">
      {/* use shared Header so nav is consistent across pages */}
      <Header
        title="Curriculum"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="curriculum"
      />

      <section className="container" style={{ background: "#ffffff" }}>
        <div className="curriculum-controls">
          <div>
            <strong>Select Year:</strong>
            <button
              className={`curr-btn ${selectedYear === 1 ? "active" : ""}`}
              onClick={() => selectYear(1)}
            >
              Year 1
            </button>
            <button
              className={`curr-btn ${selectedYear === 2 ? "active" : ""}`}
              onClick={() => selectYear(2)}
            >
              Year 2
            </button>
            <button
              className={`curr-btn ${selectedYear === 3 ? "active" : ""}`}
              onClick={() => selectYear(3)}
            >
              Year 3
            </button>
            <button
              className={`curr-btn ${selectedYear === 4 ? "active" : ""}`}
              onClick={() => selectYear(4)}
            >
              Year 4
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <strong>Select Semester:</strong>
            <button
              className={`curr-btn ${selectedSemester === 1 ? "active" : ""}`}
              onClick={() => selectSemester(1)}
            >
              Semester 1
            </button>
            <button
              className={`curr-btn ${selectedSemester === 2 ? "active" : ""}`}
              onClick={() => selectSemester(2)}
            >
              Semester 2
            </button>
          </div>
        </div>

        <div id="curriculumCards" className="curriculum-cards">
          {currentCourses.map((courseItem, idx) => (
            <div
              className="card"
              key={idx}
              onClick={() => openCurriculumModal(idx)}
            >
              <div style={{ fontSize: 40 }}>{courseItem.img}</div>
              <h3>{courseItem.title}</h3>
              <p>{courseItem.code}</p>
            </div>
          ))}
        </div>

        {modalOpen && (
          <div
            id="curriculumModal"
            className="curriculum-modal"
            style={{ display: "flex" }}
          >
            <div className="curriculum-modal-content">
              <button
                id="currClose"
                className="curr-close"
                onClick={closeCurriculumModal}
              >
                ✖
              </button>
              <button id="currPrev" className="curr-prev" onClick={prevCourse}>
                ⟨
              </button>
              <button id="currNext" className="curr-next" onClick={nextCourse}>
                ⟩
              </button>
              <div
                id="currModalImg"
                style={{
                  width: 60,
                  height: 60,
                  marginBottom: 10,
                  fontSize: 40,
                }}
              >
                {course.img}
              </div>
              <h2 id="currModalTitle">{course.title}</h2>
              <p id="currModalClsCredits">
                {course.cls} | Credits: {course.credits}
              </p>
              <p id="currModalDesc">{course.desc}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// GPA Calculator Page Component with Autocomplete
function GPAPage({ currentUser, onLogout, onNavigate }) {
  const authToken = localStorage.getItem("authToken");
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([{ name: "", credits: 3, grade: "A" }]);
  const [gpa, setGpa] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState(null);
  const inputRefs = useRef([]);
  const [selectedSemester, setSelectedSemester] = useState("all"); // "all", "1", or "2"

  useEffect(() => {
    if (authToken) {
      fetch(`${API_BASE_URL}/transcript`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setTranscript(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load transcript:", err);
          setLoading(false);
        });
    }
  }, [authToken]);

  const gradeMap = {
    A: 4.0,
    "B+": 3.5,
    B: 3.0,
    "C+": 2.5,
    C: 2.0,
    "D+": 1.5,
    D: 1.0,
    F: 0,
  };

  // Curriculum data - all courses with credits
  const curriculum = {
    1: {
      1: {
        semesterTotalCredits: 21,
        courses: [
          {
            code: "1006710",
            title: "Introduction to Calculus",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "1286111",
            title: "Circuits and Electronics",
            cls: "(3-3-8)",
            credits: 4,
          },
          {
            code: "1286120",
            title: "Elementary Systems Programming",
            cls: "(3-3-8)",
            credits: 4,
          },
          {
            code: "1286121",
            title: "Computer Programming",
            cls: "(3-3-8)",
            credits: 4,
          },
          {
            code: "96641002",
            title: "Digital Intelligence Quotient",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "96642170",
            title: "Introduction to Logic",
            cls: "(3-0-6)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 20,
        courses: [
          { code: "13006008", title: "Calculus 2", cls: "(3-0-6)", credits: 3 },
          {
            code: "13006209",
            title: "Academic English 2",
            cls: "(3-2-7)",
            credits: 3,
          },
          {
            code: "96642012",
            title: "Design Thinking",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016105",
            title: "Discrete Mathematics",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016204",
            title: "Digital Circuit and Logic Design",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016205",
            title: "Digital Circuit Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016209",
            title: "Object-Oriented Concepts and Programming",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016210",
            title: "Object-Oriented Programming Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
        ],
      },
    },
    2: {
      1: {
        semesterTotalCredits: 20,
        courses: [
          {
            code: "13006006",
            title: "Linear Algebra",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13006210",
            title: "Technical Writing",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13006403",
            title: "Business Administration",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016207",
            title: "Computer Organization and Assembly Language",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016208",
            title: "Computer Organization Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016212",
            title: "Data Structures and Algorithms",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016213",
            title: "Data Structures Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016249",
            title: "Advanced Object-Oriented Programming",
            cls: "(2-2-5)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 20,
        courses: [
          {
            code: "13006009",
            title: "Probability and Statistics",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13006211",
            title: "Technical Communication",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016214",
            title: "Software Engineering Principles",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016215",
            title: "Software Engineering Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016237",
            title: "Information Systems and Databases",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016239",
            title: "Algorithm Design and Analysis",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016241",
            title: "Computer Networks",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016242",
            title: "Networks Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
        ],
      },
    },
    3: {
      1: {
        semesterTotalCredits: 19,
        courses: [
          {
            code: "13016223",
            title: "Artificial Intelligence",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016384",
            title: "Database Systems",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016219",
            title: "Object-Oriented Analysis and Design",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016220",
            title: "OO Analysis Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016216",
            title: "Operating Systems",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016240",
            title: "Theory of Computation",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016344",
            title: "Web Programming",
            cls: "(3-0-6)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 18,
        courses: [
          {
            code: "13016226",
            title: "Compiler Construction",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016385",
            title: "Distributed Computing",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016386",
            title: "Enterprise Software Development",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016228",
            title: "Software Design and Architecture",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016230",
            title: "Software Development Process",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016294",
            title: "Team Software Project",
            cls: "(0-9-5)",
            credits: 3,
          },
        ],
      },
    },
    4: {
      1: {
        semesterTotalCredits: 15,
        courses: [
          {
            code: "13______",
            title: "Free Elective",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016243",
            title: "Human-Computer Interaction",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016348",
            title: "Advanced Computer Networks",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016291",
            title: "Software Project 1",
            cls: "(0-9-5)",
            credits: 3,
          },
          {
            code: "13016224",
            title: "Software Verification",
            cls: "(3-0-6)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 21,
        courses: [
          {
            code: "13006401",
            title: "Computer Ethics and Law",
            cls: "(0-24-12)",
            credits: 12,
          },
          {
            code: "13______",
            title: "Free Elective",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016348",
            title: "Advanced Computer Networks",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016292",
            title: "Software Project 2",
            cls: "(0-9-5)",
            credits: 3,
          },
        ],
      },
    },
  };

  const electivePools = {
    majorElectives: [
      {
        code: "13016348",
        title: "Advanced Topics in Computer Networks",
        credits: 3,
      },
      {
        code: "13016337",
        title: "Advanced Topics in Database Systems",
        credits: 3,
      },
      {
        code: "13016324",
        title: "Advanced Topics in Software Architecture",
        credits: 3,
      },
      {
        code: "13016323",
        title: "Advanced Topics in Software Engineering",
        credits: 3,
      },
      {
        code: "13016362",
        title: "Applied Artificial Intelligence",
        credits: 3,
      },
      { code: "13016394", title: "Big Data", credits: 3 },
      { code: "13016387", title: "Business Intelligence", credits: 3 },
      { code: "13016395", title: "Computational Intelligence", credits: 3 },
      { code: "13016347", title: "Computer and Network Security", credits: 3 },
      { code: "13016320", title: "Computer Graphics", credits: 3 },
      { code: "13016401", title: "Computer Vision", credits: 3 },
      { code: "13016366", title: "Data Mining", credits: 3 },
      { code: "13016400", title: "Digital Image Processing", credits: 3 },
      { code: "13016385", title: "Distributed Computing", credits: 3 },
      {
        code: "13016386",
        title: "Enterprise Software Development",
        credits: 3,
      },
      { code: "13016321", title: "Game Development", credits: 3 },
      { code: "13016364", title: "Machine Learning", credits: 3 },
      { code: "13016397", title: "Natural Language Processing", credits: 3 },
    ],
  };

  // Flatten all courses into a single array
  const getAllCourses = () => {
    const courses = [];

    // Add courses from curriculum
    Object.values(curriculum).forEach((year) => {
      Object.values(year).forEach((semester) => {
        courses.push(...semester.courses);
      });
    });

    // Add elective courses
    courses.push(...electivePools.majorElectives);

    return courses;
  };

  const allCourses = getAllCourses();

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, rows.length);
  }, [rows.length]);

  function addRow() {
    setRows((r) => [...r, { name: "", credits: 3, grade: "A" }]);
  }

  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
    if (focusedRowIndex === idx) {
      setShowSuggestions(false);
      setFocusedRowIndex(null);
    }
  }

  function updateRow(idx, field, value) {
    setRows((r) => {
      const copy = [...r];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function handleCourseNameChange(idx, value) {
    updateRow(idx, "name", value);

    if (value.trim().length > 0) {
      const filtered = allCourses.filter((course) =>
        course.title.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
      setFocusedRowIndex(idx);
      setActiveSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }

  function selectCourse(idx, course) {
    updateRow(idx, "name", course.title);
    updateRow(idx, "credits", course.credits);
    setShowSuggestions(false);
    setSuggestions([]);
    setFocusedRowIndex(null);
  }

  function handleKeyDown(e, idx) {
    if (!showSuggestions || focusedRowIndex !== idx) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      selectCourse(idx, suggestions[activeSuggestionIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }

  function calculateGPA() {
    let totalCredits = 0;
    let totalPoints = 0;
    rows.forEach((row) => {
      const credits = parseFloat(row.credits) || 0;
      const gradeVal = gradeMap[row.grade] ?? 0;
      totalCredits += credits;
      totalPoints += credits * gradeVal;
    });
    if (totalCredits === 0) {
      setGpa(0);
      return;
    }
    const result = totalPoints / totalCredits;
    setGpa(Math.round(result * 100) / 100);
  }

  function reset() {
    setRows([{ name: "", credits: 3, grade: "A" }]);
    setGpa(null);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  const exportToPDF = () => {
    if (!transcript) return;
    
    const printWindow = window.open("", "_blank");
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transcript - ${transcript.student_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { margin-top: 20px; padding: 15px; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Academic Transcript</h1>
          <div>
            <p><strong>Student ID:</strong> ${transcript.student_student_id}</p>
            <p><strong>Name:</strong> ${transcript.student_name}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Credits</th>
                <th>Grade</th>
                <th>Semester</th>
                <th>Year</th>
              </tr>
            </thead>
            <tbody>
              ${transcript.courses.map(c => `
                <tr>
                  <td>${c.course_code}</td>
                  <td>${c.course_title}</td>
                  <td>${c.credits}</td>
                  <td>${c.grade}</td>
                  <td>${c.semester}</td>
                  <td>${c.year}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            <p><strong>Total Credits:</strong> ${transcript.total_credits}</p>
            <p><strong>Earned Credits:</strong> ${transcript.earned_credits}</p>
            <p><strong>GPA:</strong> ${transcript.gpa.toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="page-container">
      <Header
        title="Transcript & GPA"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="gpa"
      />

      <section style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Transcript Section */}
        {transcript && (
          <div className="transcript-card" style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <h2 style={{ margin: 0, color: "var(--text-light)", fontSize: "1.75rem", fontWeight: "700", textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)" }}>Academic Transcript</h2>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                <div className="transcript-semester-controls">
                  <button
                    type="button"
                    onClick={() => setSelectedSemester("all")}
                    className={`curr-btn ${selectedSemester === "all" ? "active" : ""}`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSemester("1")}
                    className={`curr-btn ${selectedSemester === "1" ? "active" : ""}`}
                  >
                    Semester 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSemester("2")}
                    className={`curr-btn ${selectedSemester === "2" ? "active" : ""}`}
                  >
                    Semester 2
                  </button>
                </div>
                <button className="submit-btn" onClick={exportToPDF} style={{ boxShadow: "var(--shadow-button)" }}>
                  Export to PDF
                </button>
              </div>
            </div>
            <div className="transcript-student-info" style={{ marginBottom: "1.5rem" }}>
              <p style={{ color: "rgba(255, 255, 255, 0.95)", marginBottom: "0.5rem", fontSize: "1rem" }}>
                <strong style={{ fontWeight: "600" }}>Student ID:</strong> {transcript.student_student_id}
              </p>
              <p style={{ color: "rgba(255, 255, 255, 0.95)", fontSize: "1rem" }}>
                <strong style={{ fontWeight: "600" }}>Name:</strong> {transcript.student_name}
              </p>
            </div>
            {transcript.courses.length > 0 ? (
              <>
                {(() => {
                  const filteredCourses = selectedSemester === "all" 
                    ? transcript.courses 
                    : transcript.courses.filter(c => c.semester === selectedSemester);
                  
                  const filteredTotalCredits = filteredCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
                  const filteredEarnedCredits = filteredCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
                  
                  // Calculate GPA for filtered courses
                  const gradeMap = {
                    A: 4.0, "A+": 4.0,
                    "B+": 3.5, B: 3.0,
                    "C+": 2.5, C: 2.0,
                    "D+": 1.5, D: 1.0,
                    F: 0
                  };
                  let totalPoints = 0;
                  let totalCredits = 0;
                  filteredCourses.forEach(c => {
                    const grade = c.grade?.toUpperCase();
                    if (grade && gradeMap[grade] !== undefined) {
                      totalPoints += gradeMap[grade] * (c.credits || 0);
                      totalCredits += (c.credits || 0);
                    }
                  });
                  const filteredGPA = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";
                  
                  return (
                    <>
                      <div className="transcript-table-wrapper">
                        <table className="transcript-table">
                          <thead>
                            <tr>
                              <th>Course Code</th>
                              <th>Course Title</th>
                              <th>Credits</th>
                              <th>Grade</th>
                              <th>Semester</th>
                              <th>Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCourses.length > 0 ? (
                              filteredCourses.map((c, idx) => (
                                <tr key={idx}>
                                  <td>{c.course_code}</td>
                                  <td>{c.course_title}</td>
                                  <td>{c.credits}</td>
                                  <td><strong>{c.grade}</strong></td>
                                  <td>{c.semester}</td>
                                  <td>{c.year}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "rgba(255, 255, 255, 0.7)" }}>
                                  No courses found for Semester {selectedSemester}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="transcript-stats">
                        <div className="transcript-stat-item">
                          <strong>Total Credits:</strong> {filteredTotalCredits}
                        </div>
                        <div className="transcript-stat-item">
                          <strong>Earned Credits:</strong> {filteredEarnedCredits}
                        </div>
                        <div className="transcript-stat-item">
                          <strong>GPA:</strong> <span className="transcript-gpa">{filteredGPA}</span>
                          {selectedSemester !== "all" && <span className="transcript-semester-label">(Semester {selectedSemester})</span>}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <p style={{ color: "rgba(255, 255, 255, 0.8)", textAlign: "center", padding: "2rem", fontSize: "1rem" }}>
                No grades recorded yet. Your transcript will appear here once grades are entered.
              </p>
            )}
          </div>
        )}

        <div className="gpa-calculator-card">
          <h2 style={{ margin: 0, marginBottom: "0.75rem", color: "var(--text-light)", fontSize: "1.75rem", fontWeight: "700", textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)" }}>GPA Calculator</h2>
          <p style={{ marginBottom: "1.5rem", color: "rgba(255, 255, 255, 0.9)", fontSize: "1rem", lineHeight: "1.6" }}>
            Add your courses with credits and grades. Press Calculate to compute
            your GPA.
          </p>

          <div className="gpa-calculator-rows">
          {rows.map((row, idx) => (
            <div key={idx} className="gpa-row-item">
              <div className="gpa-row-inputs">
                <div className="gpa-course-input-wrapper">
                  <input
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    placeholder="Course name"
                    value={row.name}
                    onChange={(e) =>
                      handleCourseNameChange(idx, e.target.value)
                    }
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    onFocus={() => {
                      if (row.name.trim().length > 0) {
                        const filtered = allCourses.filter((course) =>
                          course.title
                            .toLowerCase()
                            .includes(row.name.toLowerCase())
                        );
                        setSuggestions(filtered);
                        setShowSuggestions(true);
                        setFocusedRowIndex(idx);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowSuggestions(false);
                        setSuggestions([]);
                        setFocusedRowIndex(null);
                      }, 200);
                    }}
                    className="gpa-input"
                  />

                  {showSuggestions &&
                    focusedRowIndex === idx &&
                    suggestions.length > 0 && (
                      <div className="gpa-suggestions">
                        {suggestions.map((course, sIdx) => (
                          <div
                            key={course.code + "-" + sIdx}
                            onClick={() => selectCourse(idx, course)}
                            className={`gpa-suggestion-item ${activeSuggestionIndex === sIdx ? "active" : ""}`}
                            onMouseEnter={() => setActiveSuggestionIndex(sIdx)}
                          >
                            <div className="gpa-suggestion-title">
                              {course.title}
                            </div>
                            <div className="gpa-suggestion-meta">
                              {course.code} • {course.credits} credits
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.credits}
                  onChange={(e) => updateRow(idx, "credits", e.target.value)}
                  className="gpa-input gpa-input-small"
                  placeholder="Credits"
                />

                <select
                  value={row.grade}
                  onChange={(e) => updateRow(idx, "grade", e.target.value)}
                  className="gpa-select"
                >
                  {Object.keys(gradeMap).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => removeRow(idx)}
                  className="gpa-remove-btn"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="gpa-actions">
            <button onClick={addRow} className="submit-btn">
              Add Course
            </button>
            <button onClick={calculateGPA} className="submit-btn">
              Calculate GPA
            </button>
            <button onClick={reset} className="return-btn">
              Reset
            </button>
          </div>
          </div>

          {gpa !== null && (
            <div className="gpa-result-card">
              <h3 className="gpa-result-title">Your GPA: <span className="gpa-result-value">{gpa}</span></h3>
              <p className="gpa-result-message">
                {gpa >= 3.5
                  ? "Excellent — Keep it up!"
                  : gpa >= 3.0
                    ? "Good — Aim higher!"
                    : gpa >= 2.0
                      ? "Satisfactory — Improvement possible"
                      : "Needs attention — seek help"}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Credits / Credit Planner Page Component - Enhanced Version
function CreditsPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [courses, setCourses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [registrations, setRegistrations] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Load courses from backend
  useEffect(() => {
    if (authToken) {
      fetch(`${API_BASE_URL}/courses`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => setCourses(data))
        .catch((err) => console.error("Failed to load courses:", err));
      
      // Load existing registrations
      fetch(`${API_BASE_URL}/course-registrations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => setRegistrations(data))
        .catch((err) => console.error("Failed to load registrations:", err));
    }
  }, [authToken]);

  // Map course code to course ID
  const getCourseId = (code) => {
    const course = courses.find((c) => c.code === code);
    return course ? course.id : null;
  };

  // Submit selected courses to admin
  const submitToAdmin = async () => {
    if (selectedCodes.size === 0) {
      setSubmitMessage("Please select at least one course");
      return;
    }

    setSubmitting(true);
    setSubmitMessage("");

    try {
      const courseIds = Array.from(selectedCodes)
        .map((code) => getCourseId(code))
        .filter((id) => id !== null);

      if (courseIds.length === 0) {
        setSubmitMessage("Selected courses not found in system. Please ensure courses are added by admin.");
        setSubmitting(false);
        return;
      }

      const semesterName = semSel === "1" ? "1" : "2";
      const response = await fetch(`${API_BASE_URL}/course-registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          course_ids: courseIds,
          semester: semesterName,
          year: parseInt(currentYear),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubmitMessage(`Successfully submitted ${data.length} course registration(s) to admin for approval!`);
        // Reload registrations
        const regResponse = await fetch(`${API_BASE_URL}/course-registrations`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const regData = await regResponse.json();
        setRegistrations(regData);
        // Lock the selection
        setIsLocked(true);
        localStorage.setItem(`curriculum_${yearSel}_${semSel}_locked`, "true");
      } else {
        const error = await response.json();
        setSubmitMessage(error.detail || "Failed to submit registrations");
      }
    } catch (error) {
      setSubmitMessage("Error submitting registrations: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // curriculum data (copied from provided HTML)
  const curriculum = {
    1: {
      1: {
        semesterTotalCredits: 21,
        courses: [
          {
            code: "1006710",
            title: "Introduction to Calculus",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "1286111",
            title: "Circuits and Electronics",
            cls: "(3-3-8)",
            credits: 4,
          },
          {
            code: "1286120",
            title: "Elementary Systems Programming",
            cls: "(3-3-8)",
            credits: 4,
          },
          {
            code: "1286121",
            title: "Computer Programming",
            cls: "(3-3-8)",
            credits: 4,
          },
          {
            code: "96641002",
            title: "Digital Intelligence Quotient",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "96642170",
            title: "Introduction to Logic",
            cls: "(3-0-6)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 20,
        courses: [
          { code: "13006008", title: "Calculus 2", cls: "(3-0-6)", credits: 3 },
          {
            code: "13006209",
            title: "Academic English 2",
            cls: "(3-2-7)",
            credits: 3,
          },
          {
            code: "96642012",
            title: "Design Thinking",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016105",
            title: "Discrete Mathematics",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016204",
            title: "Digital Circuit and Logic Design",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016205",
            title: "Digital Circuit Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016209",
            title: "Object-Oriented Concepts and Programming",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016210",
            title: "Object-Oriented Programming Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
        ],
      },
    },
    2: {
      1: {
        semesterTotalCredits: 20,
        courses: [
          {
            code: "13006006",
            title: "Linear Algebra",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13006210",
            title: "Technical Writing",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13006403",
            title: "Business Administration",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016207",
            title: "Computer Organization and Assembly Language",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016208",
            title: "Computer Organization Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016212",
            title: "Data Structures and Algorithms",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016213",
            title: "Data Structures Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016249",
            title: "Advanced Object-Oriented Programming",
            cls: "(2-2-5)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 20,
        courses: [
          {
            code: "13006009",
            title: "Probability and Statistics",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13006211",
            title: "Technical Communication",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016214",
            title: "Software Engineering Principles",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016215",
            title: "Software Engineering Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016237",
            title: "Information Systems and Databases",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016239",
            title: "Algorithm Design and Analysis",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016241",
            title: "Computer Networks",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016242",
            title: "Networks Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
        ],
      },
    },
    3: {
      1: {
        semesterTotalCredits: 19,
        courses: [
          {
            code: "13016223",
            title: "Artificial Intelligence",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016384",
            title: "Database Systems",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016219",
            title: "Object-Oriented Analysis and Design",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016220",
            title: "OO Analysis Laboratory",
            cls: "(0-3-2)",
            credits: 1,
          },
          {
            code: "13016216",
            title: "Operating Systems",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016240",
            title: "Theory of Computation",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016344",
            title: "Web Programming",
            cls: "(3-0-6)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 18,
        courses: [
          {
            code: "13016226",
            title: "Compiler Construction",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016385",
            title: "Distributed Computing",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016386",
            title: "Enterprise Software Development",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016228",
            title: "Software Design and Architecture",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016230",
            title: "Software Development Process",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016294",
            title: "Team Software Project",
            cls: "(0-9-5)",
            credits: 3,
          },
        ],
      },
    },
    4: {
      1: {
        semesterTotalCredits: 15,
        courses: [
          {
            code: "13______",
            title: "Free Elective",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016243",
            title: "Human-Computer Interaction",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016348",
            title: "Advanced Computer Networks",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016291",
            title: "Software Project 1",
            cls: "(0-9-5)",
            credits: 3,
          },
          {
            code: "13016224",
            title: "Software Verification",
            cls: "(3-0-6)",
            credits: 3,
          },
        ],
      },
      2: {
        semesterTotalCredits: 21,
        courses: [
          {
            code: "13006401",
            title: "Computer Ethics and Law",
            cls: "(0-24-12)",
            credits: 12,
          },
          {
            code: "13______",
            title: "Free Elective",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016348",
            title: "Advanced Computer Networks",
            cls: "(3-0-6)",
            credits: 3,
          },
          {
            code: "13016292",
            title: "Software Project 2",
            cls: "(0-9-5)",
            credits: 3,
          },
        ],
      },
    },
  };

  const electivePools = {
    majorElectives: [
      {
        code: "13016348",
        title: "Advanced Topics in Computer Networks",
        credits: 3,
      },
      {
        code: "13016337",
        title: "Advanced Topics in Database Systems",
        credits: 3,
      },
      {
        code: "13016324",
        title: "Advanced Topics in Software Architecture",
        credits: 3,
      },
      {
        code: "13016323",
        title: "Advanced Topics in Software Engineering",
        credits: 3,
      },
      {
        code: "13016362",
        title: "Applied Artificial Intelligence",
        credits: 3,
      },
      { code: "13016394", title: "Big Data", credits: 3 },
      { code: "13016387", title: "Business Intelligence", credits: 3 },
      { code: "13016395", title: "Computational Intelligence", credits: 3 },
      { code: "13016347", title: "Computer and Network Security", credits: 3 },
      { code: "13016320", title: "Computer Graphics", credits: 3 },
      { code: "13016401", title: "Computer Vision", credits: 3 },
      { code: "13016366", title: "Data Mining", credits: 3 },
      { code: "13016400", title: "Digital Image Processing", credits: 3 },
      { code: "13016385", title: "Distributed Computing", credits: 3 },
      {
        code: "13016386",
        title: "Enterprise Software Development",
        credits: 3,
      },
      { code: "13016321", title: "Game Development", credits: 3 },
      { code: "13016364", title: "Machine Learning", credits: 3 },
      { code: "13016397", title: "Natural Language Processing", credits: 3 },
    ],
  };

  const [yearSel, setYearSel] = useState("1");
  const [semSel, setSemSel] = useState("1");
  const [available, setAvailable] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState(new Set());
  const [targetCredits, setTargetCredits] = useState("—");
  const [selectedCredits, setSelectedCredits] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showMajor, setShowMajor] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // NEW: Track if progress is saved/locked
  const [savedCourses, setSavedCourses] = useState([]);

  useEffect(() => {
    loadSubjectsFor(yearSel, semSel);
  }, [yearSel, semSel]);

  function loadSubjectsFor(y, s) {
    const yNum = parseInt(y, 10);
    const sNum = parseInt(s, 10);
    if (!curriculum[yNum] || !curriculum[yNum][sNum]) {
      setAvailable([]);
      setTargetCredits("—");
      setSelectedCodes(new Set());
      setSelectedCredits(0);
      setSuggestions([]);
      setIsLocked(false);
      return;
    }

    const semObj = curriculum[yNum][sNum];
    setAvailable(semObj.courses.map((c) => ({ ...c })));
    setTargetCredits(semObj.semesterTotalCredits);
    setSelectedCodes(new Set());
    setSelectedCredits(0);
    setSuggestions([]);

    // Check if this semester has saved progress
    const savedLockStatus = localStorage.getItem(`curriculum_${y}_${s}_locked`);
    setIsLocked(savedLockStatus === "true");

    // Load any saved progress
    loadSavedProgress(yNum, sNum, semObj.courses);
  }

  function toggleSelect(code, credits) {
    if (isLocked) return; // Prevent selection when locked

    setSelectedCodes((prev) => {
      const copy = new Set(prev);
      if (copy.has(code)) {
        copy.delete(code);
      } else {
        copy.add(code);
      }
      const total = available.reduce((acc, cur) => {
        if (copy.has(cur.code)) return acc + (parseFloat(cur.credits) || 0);
        return acc;
      }, 0);
      setSelectedCredits(total);
      suggestToFill(yearSel, semSel, targetCredits, copy);
      return copy;
    });
  }

  function deleteCourse(idx) {
    if (isLocked) return; // Prevent deletion when locked

    setAvailable((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) {
        setDeleted((d) => {
          if (!d.find((c) => c.code === removed.code)) return [...d, removed];
          return d;
        });
        setSelectedCodes((prevSelected) => {
          const copySel = new Set(prevSelected);
          if (copySel.has(removed.code)) {
            copySel.delete(removed.code);
          }
          const total = copy.reduce((acc, cur) => {
            if (copySel.has(cur.code))
              return acc + (parseFloat(cur.credits) || 0);
            return acc;
          }, 0);
          setSelectedCredits(total);
          suggestToFill(yearSel, semSel, targetCredits, copySel, copy);
          return copySel;
        });
      }
      return copy;
    });
  }

  function addCourseToTable(course) {
    if (isLocked) return; // Prevent adding when locked

    setAvailable((prev) => {
      const next = [...prev, course];
      suggestToFill(yearSel, semSel, targetCredits, selectedCodes, next);
      return next;
    });
    setDeleted((d) => d.filter((c) => c.code !== course.code));
  }

  function editProgress() {
    setIsLocked(false);
    localStorage.setItem(`curriculum_${yearSel}_${semSel}_locked`, "false");

    // Reload all courses for the semester when editing
    const yNum = parseInt(yearSel, 10);
    const sNum = parseInt(semSel, 10);
    if (curriculum[yNum] && curriculum[yNum][sNum]) {
      const semObj = curriculum[yNum][sNum];
      setAvailable(semObj.courses.map((c) => ({ ...c })));
    }
  }
  function saveProgress() {
    const y = yearSel;
    const s = semSel;
    const arr = Array.from(selectedCodes);

    // Get only the selected courses from available list
    const selectedCoursesData = available.filter((course) =>
      selectedCodes.has(course.code)
    );

    // Save selected courses codes
    localStorage.setItem(`curriculum_${y}_${s}`, JSON.stringify(arr));

    // Save only selected courses data
    localStorage.setItem(
      `curriculum_${y}_${s}_courses`,
      JSON.stringify(selectedCoursesData)
    );

    // Set saved courses for display
    setSavedCourses(selectedCoursesData);

    // Lock the semester
    localStorage.setItem(`curriculum_${y}_${s}_locked`, "true");
    setIsLocked(true);
  }
  function loadSavedProgress(y, s, semCourses) {
    const key = `curriculum_${y}_${s}`;
    const saved = localStorage.getItem(key);

    // Load saved courses list (only selected courses)
    const savedCoursesKey = `curriculum_${y}_${s}_courses`;
    const savedCoursesData = localStorage.getItem(savedCoursesKey);
    if (savedCoursesData) {
      try {
        const parsedCourses = JSON.parse(savedCoursesData);
        setSavedCourses(parsedCourses);
      } catch (e) {
        setSavedCourses([]);
      }
    } else {
      setSavedCourses([]);
    }

    if (!saved) return;
    try {
      const codes = JSON.parse(saved);
      const set = new Set(codes);
      setSelectedCodes(set);

      const coursesToUse = savedCoursesData
        ? JSON.parse(savedCoursesData)
        : semCourses;
      const total = coursesToUse.reduce((acc, cur) => {
        if (set.has(cur.code)) return acc + (cur.credits || 0);
        return acc;
      }, 0);
      setSelectedCredits(total);
      suggestToFill(
        y,
        s,
        curriculum[parseInt(y)][parseInt(s)].semesterTotalCredits,
        set,
        coursesToUse.map((c) => ({ ...c }))
      );
    } catch (e) {
      // ignore parse errors
    }
  }
  function suggestToFill(y, s, target, selectedSet, availableList = null) {
    const yNum = parseInt(y, 10);
    const sNum = parseInt(s, 10);
    const semObj = curriculum[yNum] && curriculum[yNum][sNum];
    if (!semObj) {
      setSuggestions([]);
      return;
    }

    const list = Array.isArray(availableList) ? availableList : available;

    const selectedTotal = list.reduce((acc, cur) => {
      if (selectedSet && selectedSet.has(cur.code))
        return acc + (parseFloat(cur.credits) || 0);
      return acc;
    }, 0);

    const deficit = Math.max(0, (target || 0) - selectedTotal);

    if (deficit <= 0) {
      setSuggestions([]);
      return;
    }

    // Convert backend courses to match elective format
    const backendElectives = courses.map(c => ({
      code: c.code,
      title: c.title,
      credits: c.credits
    }));
    
    // Combine backend courses with elective pools for suggestions
    const allElectiveOptions = [...electivePools.majorElectives, ...backendElectives];

    const presentCodes = new Set(list.map((c) => c.code));
    const electiveCandidates = [];
    
    // Add courses from combined elective pools (hardcoded + backend)
    for (const e of allElectiveOptions) {
      if (presentCodes.has(e.code)) continue;
      if (selectedSet && selectedSet.has(e.code)) continue;
      if (electiveCandidates.find((c) => c.code === e.code)) continue;
      electiveCandidates.push(e);
    }

    setSuggestions(electiveCandidates);
  }

  return (
    <div className="page-container">
      <Header
        title="Credit Planner"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="credit"
      />

      <section className="credit-container">
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <label htmlFor="yearSel">Academic Year</label>
            <br />
            <select
              id="yearSel"
              value={yearSel}
              onChange={(e) => setYearSel(e.target.value)}
            >
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>
          <div>
            <label htmlFor="semSel">Semester</label>
            <br />
            <select
              id="semSel"
              value={semSel}
              onChange={(e) => setSemSel(e.target.value)}
            >
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isLocked ? (
              <>
                <button onClick={saveProgress} className="submit-btn">
                  Save Progress
                </button>
                <button
                  onClick={submitToAdmin}
                  className="submit-btn"
                  style={{ background: "#10b981" }}
                  disabled={submitting || selectedCodes.size === 0}
                >
                  {submitting ? "Submitting..." : "Submit to Admin"}
                </button>
              </>
            ) : (
              <button
                onClick={editProgress}
                className="submit-btn"
                style={{ background: "#5568d3" }}
              >
                Edit Progress
              </button>
            )}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div className="small muted">
              Semester target credits:{" "}
              <strong id="targetCredits">{targetCredits}</strong>
            </div>
          </div>
        </div>

        {submitMessage && (
          <div
            style={{
              background: submitMessage.includes("Successfully") ? "#d1fae5" : "#fee2e2",
              border: submitMessage.includes("Successfully") ? "1px solid #10b981" : "1px solid #ef4444",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
              color: submitMessage.includes("Successfully") ? "#065f46" : "#991b1b",
              fontWeight: "600",
            }}
          >
            {submitMessage}
          </div>
        )}
        {isLocked && (
          <div
            style={{
              background: "#d1fae5",
              border: "1px solid #10b981",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
              color: "#065f46",
              fontWeight: "600",
            }}
          >
            ✓ Progress Saved - Click "Edit Progress" to make changes
          </div>
        )}
        {/* Show registration status */}
        {registrations.length > 0 && (
          <div className="card" style={{ marginBottom: "12px" }}>
            <strong>Registration Status</strong>
            <table style={{ marginTop: "8px" }}>
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Semester</th>
                  <th>Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {registrations
                  .filter((r) => r.semester === semSel && r.year === currentYear)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.course_code}</td>
                      <td>{r.course_title}</td>
                      <td>{r.semester}</td>
                      <td>{r.year}</td>
                      <td>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background:
                              r.status === "approved"
                                ? "#d1fae5"
                                : r.status === "rejected"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              r.status === "approved"
                                ? "#065f46"
                                : r.status === "rejected"
                                ? "#991b1b"
                                : "#92400e",
                            fontWeight: "600",
                          }}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          {available.length === 0 ? (
            <em>
              No subjects defined for Year {yearSel} Semester {semSel}.
            </em>
          ) : (
            <>
              {!isLocked ? (
                <table>
                  <thead>
                    <tr>
                      <th className="center">Select</th>
                      <th>Code</th>
                      <th>Course Title</th>
                      <th className="center">Credits</th>
                      <th className="center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.map((c, i) => (
                      <tr key={c.code}>
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={selectedCodes.has(c.code)}
                            onChange={() => toggleSelect(c.code, c.credits)}
                          />
                        </td>
                        <td>{c.code}</td>
                        <td>
                          {c.title}{" "}
                          <span className="small muted">{c.cls || ""}</span>
                        </td>
                        <td className="center">{c.credits}</td>
                        <td className="center">
                          <button
                            className="deleteBtn"
                            onClick={() => deleteCourse(i)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="saved-courses-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Course Title</th>
                      <th className="center">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedCourses.map((c) => (
                      <tr key={c.code} style={{ background: "#f0fdf4" }}>
                        <td>{c.code}</td>
                        <td>
                          {c.title}{" "}
                          <span className="small muted">{c.cls || ""}</span>
                        </td>
                        <td className="center">{c.credits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
        {/* <div>
          {available.length === 0 ? (
            <div className="card">
              <em>
                No subjects defined for Year {yearSel} Semester {semSel}.
              </em>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {!isLocked && <th className="center">Select</th>}
                  <th>Code</th>
                  <th>Course Title</th>
                  <th className="center">Credits</th>
                  {!isLocked && <th className="center">Action</th>}
                </tr>
              </thead>
              <tbody>
                {available.map((c, i) => (
                  <tr key={c.code} style={{ 
                    background: isLocked && selectedCodes.has(c.code) ? '#f0fdf4' : 'transparent' 
                  }}>
                    {!isLocked && (
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(c.code)}
                          onChange={() => toggleSelect(c.code, c.credits)}
                        />
                      </td>
                    )}
                    <td>{c.code}</td>
                    <td>
                      {c.title}{" "}
                      <span className="small muted">{c.cls || ""}</span>
                    </td>
                    <td className="center">{c.credits}</td>
                    {!isLocked && (
                      <td className="center">
                        <button
                          className="deleteBtn"
                          onClick={() => deleteCourse(i)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div> */}

        <div className="summary">
          <div className="pill">
            Selected Credits:{" "}
            <strong id="selectedCredits">{selectedCredits}</strong>
          </div>
          <div className="pill">
            Remaining to Target:{" "}
            <strong id="remainingCredits">
              {targetCredits === "—"
                ? "—"
                : Math.max(0, (targetCredits || 0) - selectedCredits)}
            </strong>
          </div>
        </div>

        {!isLocked && (
          <div id="suggestions" className="card" style={{ marginTop: 12 }}>
            <strong>Suggestions</strong>
            <div id="suggestText" className="suggest" style={{ marginTop: 8 }}>
              {suggestions.length === 0 ? (
                "Load a semester and select subjects to see suggestions."
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Credits</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => (
                      <tr key={s.code}>
                        <td>{s.code}</td>
                        <td>{s.title}</td>
                        <td className="center">{s.credits}</td>
                        <td className="center">
                          <button
                            className="addBtn"
                            onClick={() => addCourseToTable(s)}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 12 }}>
          <strong>Elective Pools</strong>
          <div className="small muted" style={{ marginTop: 8 }}>
            <strong>Humanity electives (pick at least 1)</strong>: Design
            Thinking, Imaginative Art, English From Entertainment Media,
            Japanese For Travel.
            <br />
            <strong>Social Science electives (pick at least 1)</strong>:
            Introduction to Economics, Business Administration, Industrial
            Management, Business and Commercial Laws, International Trade and
            Finance, Introduction to Psychology, Introduction to Environmental
            Studies.
            <br />
            <strong>Major electives (pick at least 2 = 6 credits)</strong>:
            (many courses available)
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowMajor((s) => !s)}
              id="showMajorElectives"
              className="show-major-btn"
            >
              {showMajor
                ? "Hide Major Electives List"
                : "Show Major Electives List"}
            </button>
            {showMajor && (
              <div
                id="majorElectivesList"
                className="small muted"
                style={{
                  marginTop: 10,
                  whiteSpace: "pre-wrap",
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {electivePools.majorElectives
                  .map((e) => `${e.code} — ${e.title} (${e.credits} cr)`)
                  .join("\n")}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// Contact Page Component
function ContactPage({ currentUser, onLogout, onNavigate }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [success, setSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setIsSending(true);
    try {
      const result = await sendContactEmail(form);
      if (result.success) {
        setSuccess(true);
        setForm({ name: "", email: "", phone: "", subject: "", message: "" });
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setErrorMsg("Failed to send message. Please try again later.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="page-container">
      <Header
        title="Contact Us"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="contact"
      />

      <section className="container">
        <div className="contact-page-container">
          <h1 className="contact-page-title">Contact Us</h1>

          <div className="contact-info">
            <div className="info-card">
              <h3>📍 Address</h3>
              <p>Software Engineering Department</p>
              <p>Faculty of Engineering</p>
              <p>123 University Road</p>
              <p>Bangkok, Thailand 10330</p>
            </div>
            <div className="info-card">
              <h3>📞 Phone</h3>
              <p>+66 (0) 2-123-4567</p>
              <p>+66 (0) 2-123-4568</p>
              <p>Fax: +66 (0) 2-123-4569</p>
            </div>
            <div className="info-card">
              <h3>📧 Email</h3>
              <p>info@se.university.ac.th</p>
              <p>admissions@se.university.ac.th</p>
              <p>support@se.university.ac.th</p>
            </div>
          </div>

          <div className="contact-form-container">
            <div className={`success-message ${success ? "active" : ""}`}>
              Thank you! Your message has been sent successfully.
            </div>
            {errorMsg && <div className="error-message">{errorMsg}</div>}
            <h2>Send us a Message</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="contactName">Full Name *</label>
                <input
                  id="contactName"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactEmail">Email Address *</label>
                <input
                  id="contactEmail"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactPhone">Phone Number</label>
                <input
                  id="contactPhone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactSubject">Subject *</label>
                <input
                  id="contactSubject"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactMessage">Message *</label>
                <textarea
                  id="contactMessage"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  required
                  placeholder="Please describe how we can help you..."
                  rows="4"
                  cols="100"
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isSending}>
                {isSending ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

// Login Page Component
function LoginPage({ onLogin, onSwitchToSignup }) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, password }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("Non-JSON response:", text);
          setError(`Server error: Received non-JSON response. Please check backend logs.`);
          return;
        }
        
        const data = await response.json();
        const userResponse = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        
        if (userResponse.ok) {
          const user = await userResponse.json();
          onLogin(data.access_token, user);
        } else {
          const userErrorText = await userResponse.text();
          let userError;
          try {
            userError = JSON.parse(userErrorText);
          } catch {
            userError = { detail: userErrorText || "Failed to get user information." };
          }
          setError(userError.detail || "Failed to get user information.");
        }
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || "Unknown error occurred" };
        }
        setError(
          errorData.detail || "Login failed. Please check your credentials."
        );
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(`Network error: ${err.message}. Please check if the server is running at ${API_BASE_URL}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Header title="Welcome to SE Student Portal" />
      <div className="auth-form-container">
        <h2>🔐 Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="studentId">Student ID</label>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter your student ID"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="form-toggle">
          Don't have an account? <a onClick={onSwitchToSignup}>Sign up here</a>
        </div>
      </div>
    </div>
  );
}

// Signup Page Component
function SignupPage({ onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    year: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Special handling for studentId - only allow numbers and max 8 digits
    if (name === "studentId") {
      const numbersOnly = value.replace(/\D/g, ""); // Remove non-digits
      const limited = numbersOnly.slice(0, 8); // Limit to 8 digits
      setFormData({ ...formData, [name]: limited });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate student ID is exactly 8 digits
    if (formData.studentId.length !== 8) {
      setError("Student ID must be exactly 8 digits");
      return;
    }

    // Validate student ID contains only numbers
    if (!/^\d{8}$/.test(formData.studentId)) {
      setError("Student ID must contain only numbers");
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: formData.studentId,
          name: formData.name,
          password: formData.password,
          year: parseInt(formData.year),
        }),
      });

      if (response.ok) {
        setSuccess("Account created successfully! Redirecting to login...");
        setTimeout(() => onSwitchToLogin(), 2000);
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || "Unknown error occurred" };
        }
        setError(errorData.detail || "Signup failed. Please try again.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(`Network error: ${err.message}. Please check if the server is running at ${API_BASE_URL}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Header title="Join" />
      <div className="auth-form-container">
        <h2>🔐 Sign Up</h2>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="studentId">Student ID</label>
            <input
              type="text"
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="Enter 8-digit student ID"
              required
              maxLength="8"
              pattern="\d{8}"
            />
            <small style={{ color: "#666", fontSize: "0.85rem", marginTop: "0.3rem", display: "block" }}>
              Must be exactly 8 digits (numbers only)
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="year">Year</label>
            <select
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              required
            >
              <option value="">Select your year</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              required
              minLength="6"
            />
          </div>
          <div className="form-group">
            <label htmlFor="passwordConfirm">Confirm Password</label>
            <input
              type="password"
              id="passwordConfirm"
              name="passwordConfirm"
              value={formData.passwordConfirm}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
            />
          </div>
          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <div className="form-toggle">
          Already have an account? <a onClick={onSwitchToLogin}>Login here</a>
        </div>
      </div>
    </div>
  );
}

// Booking Page Component
function BookingPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [showModal, setShowModal] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isBooking, setIsBooking] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [success, setSuccess] = useState("");

  const openBooking = async (roomKey) => {
    setCurrentRoom(roomKey);
    setSelectedDate("");
    setSelectedSlot(null);
    setBookedSlots([]);
    setEmailStatus("");
    setShowModal(true);
  };

  const fetchBookedSlots = async () => {
    if (!selectedDate || !currentRoom) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/check?room_key=${currentRoom}&booking_date=${selectedDate}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setBookedSlots(data.booked_slots);
      }
    } catch (error) {
      console.error("Error fetching booked slots:", error);
    }
  };

  useEffect(() => {
    if (selectedDate && currentRoom) {
      fetchBookedSlots();
    }
  }, [selectedDate, currentRoom]);

  const isDateWithinOneWeek = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    const selected = new Date(dateString);
    return selected >= today && selected <= maxDate;
  };

  const handleConfirmBooking = async () => {
    if (!selectedDate || selectedSlot === null) {
      alert("Please select a date and time slot.");
      return;
    }

    if (!isDateWithinOneWeek(selectedDate)) {
      alert("You can only book from today up to 7 days in advance.");
      return;
    }

    const room = roomsData[currentRoom];
    const slots = generateHourlySlots(currentRoom, selectedDate);
    const slot = slots[selectedSlot];
    const slotIdentifier = slot.time || `Locker ${slot.locker}`;

    setIsBooking(true);
    setEmailStatus("");

    try {
      // Create booking in backend
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          room_key: currentRoom,
          room_name: room.name,
          booking_date: selectedDate,
          time_slot: slotIdentifier,
        }),
      });

      if (response.ok) {
        const booking = await response.json();

        // Send email notification silently
        const emailResult = await sendBookingEmail(booking, "NEW BOOKING");

        // Show success message in modal
        setSuccess("Booking successful! Admin notified via email.");

        // Close modal after 3 seconds
        setTimeout(() => {
          setShowModal(false);
          setSuccess("");
          setEmailStatus("");
        }, 3000);

        // Refresh booked slots
        fetchBookedSlots();
      } else {
        const error = await response.json();
        setSuccess(`Booking failed: ${error.detail}`);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="page-container">
      <Header
        title="Booking Rooms"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="booking"
      />

      {success && <div className="success-message">{success}</div>}

      <div style={{ textAlign: "center", margin: "1.5rem 0" }}>
        <button
          onClick={() => onNavigate("yourBookings")}
          className="your-bookings-btn"
        >
          Your Bookings
        </button>
      </div>

      <section className="booking-slide">
        <article className="book-item" onClick={() => openBooking("meeting")}>
          <div className="book-item-icon">📅</div>
          <h2 className="title">Meeting Room</h2>
          <p className="book-item-description">Book for up to 2 hours per session</p>
          <button className="book-item-btn">Book Now →</button>
        </article>
        <article className="book-item" onClick={() => openBooking("locker")}>
          <div className="book-item-icon">🔒</div>
          <h2 className="title">Locker</h2>
          <p className="book-item-description">No time limitation. Lockers available</p>
          <button className="book-item-btn">Book Now →</button>
        </article>
        <article className="book-item" onClick={() => openBooking("kitchen")}>
          <div className="book-item-icon">🍳</div>
          <h2 className="title">Kitchen</h2>
          <p className="book-item-description">Book for 1 hour per session ####</p>
          <button className="book-item-btn">Book Now →</button>
        </article>
      </section>

      {showModal && (
        <BookingModal
          roomKey={currentRoom}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          bookedSlots={bookedSlots}
          onConfirm={handleConfirmBooking}
          onClose={() => {
            setShowModal(false);
            setEmailStatus("");
            setSuccess("");
          }}
          isBooking={isBooking}
          emailStatus={emailStatus}
          success={success}
        />
      )}
    </div>
  );
}

// Booking Modal Component
function BookingModal({
  roomKey,
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot,
  bookedSlots,
  onConfirm,
  onClose,
  isBooking,
  emailStatus,
  success,
}) {
  const room = roomsData[roomKey];
  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="modal-success-message">
            <div className="success-icon">✓</div>
            {success}
          </div>
        ) : (
          <div className="modal-content">
            <div className="modal-header">
              <h3>{room.name} Booking</h3>
              <button className="modal-close-btn" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div className="rules-card">
              <p className="rules-description">{room.rules}</p>
            </div>

            <div className="date-selector">
              <label htmlFor="bookingDate">Select Date</label>
              <input
                type="date"
                id="bookingDate"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={today}
                max={maxDate}
                className="date-input"
              />
            </div>

            <div className="time-slot-container">
              {!selectedDate ? (
                <div className="empty-state">
                  <p>Please select a date to see available time slots</p>
                </div>
              ) : (
                <div className="time-slots-grid">
                  {(() => {
                    const slots = generateHourlySlots(roomKey, selectedDate);
                    if (!slots || slots.length === 0) {
                      return (
                        <div className="empty-state">
                          <p>No available time slots for this date</p>
                        </div>
                      );
                    }

                    return slots.map((slot, index) => {
                      const slotId = slot.time || `Locker ${slot.locker}`;
                      const available = !bookedSlots.includes(slotId);
                      const isSelected = selectedSlot === index;

                      return (
                        <div
                          key={index}
                          className={`time-slot-card ${!available ? "unavailable" : ""} ${isSelected ? "selected" : ""
                            }`}
                          onClick={() => available && setSelectedSlot(index)}
                        >
                          <div className="slot-content">
                            <div className="slot-time">{slotId}</div>
                            <div className="slot-status">
                              {available ? (
                                <span className="status-badge available">Available</span>
                              ) : (
                                <span className="status-badge booked">Booked</span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="selected-indicator">
                              <span className="check-icon">✓</span>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {emailStatus && (
              <div className="email-status-message">
                {emailStatus}
              </div>
            )}

            <div className="modal-actions">
              {(() => {
                const slots = generateHourlySlots(roomKey, selectedDate);
                let selectedSlotValid = false;
                if (
                  selectedSlot !== null &&
                  selectedDate &&
                  slots[selectedSlot]
                ) {
                  const s = slots[selectedSlot];
                  const slotId = s.time || `Locker ${s.locker}`;
                  const notBooked = !bookedSlots.includes(slotId);
                  if (s.time) {
                    selectedSlotValid =
                      isSlotInFuture(slotId, selectedDate) && notBooked;
                  } else {
                    selectedSlotValid = notBooked;
                  }
                }

                return (
                  <button
                    onClick={onConfirm}
                    disabled={!selectedDate || !selectedSlotValid || isBooking}
                    className="confirm-btn"
                  >
                    {isBooking ? (
                      <>
                        <span className="spinner"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        Confirm Booking
                      </>
                    )}
                  </button>
                );
              })()}
              <button onClick={onClose} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Cancellation Modal Component
function CancellationModal({ onClose, success }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-success-message">
          <div className="success-icon">✓</div>
          {success}
        </div>
      </div>
    </div>
  );
}

// Your Bookings Page Component
function YourBookingsPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (error) {
      console.error("Error loading bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    setCancellingId(bookingId);

    try {
      const booking = bookings.find((b) => b.id === bookingId);
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        await sendBookingEmail(booking, "BOOKING CANCELLED");
        setShowCancellationModal(true);
        setTimeout(() => {
          setShowCancellationModal(false);
        }, 3000);
        await loadBookings();
      } else {
        const error = await response.json();
        alert(`Failed to cancel booking: ${error.detail}`);
      }
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="page-container">
      <Header
        title="Your Bookings"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="yourBookings"
      />

      {showCancellationModal && (
        <CancellationModal
          success="Cancellation successful! Admin notified via email"
          onClose={() => setShowCancellationModal(false)}
        />
      )}

      {/* ADD THIS: Back to Booking Button */}
      <div style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => onNavigate("booking")}
          className="back-to-booking-btn"
        >
          ← Back to Booking
        </button>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2
          style={{
            textAlign: "center",
            marginBottom: "1.5rem",
            color: "#0ea5e9",
          }}
        >
          Your Booking History
        </h2>
        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div className="loading-spinner"></div>
            <p>Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="no-bookings-message">
            <div className="empty-state-icon">📅</div>
            <h3>No bookings yet</h3>
            <p>Start by booking a room or locker!</p>
            <button
              onClick={() => onNavigate("booking")}
              className="cta-booking-btn"
            >
              Make a Booking
            </button>
          </div>
        ) : (
          (() => {
            const upcoming = bookings
              .filter((b) => !isBookingInPast(b))
              .sort(
                (a, b) => new Date(a.booking_date) - new Date(b.booking_date)
              );
            const past = bookings
              .filter((b) => isBookingInPast(b))
              .sort(
                (a, b) => new Date(b.booking_date) - new Date(a.booking_date)
              );

            return (
              <>
                {upcoming.length > 0 && (
                  <div>
                    <h3 style={{ color: "#0ea5e9", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>🔔</span> Upcoming Bookings
                    </h3>
                    {upcoming.map((booking) => (
                      <div key={booking.id} className="booking-card">
                        <div className="booking-card-header">
                          <div className="booking-card-title">
                            {booking.room_name}
                          </div>
                          <button
                            className="cancel-booking-btn"
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancellingId === booking.id}
                          >
                            {cancellingId === booking.id ? (
                              <>
                                <span className="btn-spinner"></span>
                                Cancelling...
                              </>
                            ) : (
                              "Cancel Booking"
                            )}
                          </button>
                        </div>
                        <div className="booking-card-body">
                          <div className="booking-detail">
                            <span className="booking-detail-label">📅 Date</span>
                            <span className="booking-detail-value">
                              {formatDate(booking.booking_date)}
                            </span>
                          </div>
                          <div className="booking-detail">
                            <span className="booking-detail-label">⏰ Time Slot</span>
                            <span className="booking-detail-value">
                              {booking.time_slot}
                            </span>
                          </div>
                          <div className="booking-detail">
                            <span className="booking-detail-label">📌 Booked On</span>
                            <span className="booking-detail-value">
                              {new Date(
                                booking.created_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {past.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <h3 style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>📜</span> Past Bookings
                    </h3>
                    {past.map((booking) => (
                      <div key={booking.id} className="booking-card past-booking">
                        <div className="booking-card-header">
                          <div className="booking-card-title">
                            {booking.room_name}
                          </div>
                          <span className="past-badge">Completed</span>
                        </div>
                        <div className="booking-card-body">
                          <div className="booking-detail">
                            <span className="booking-detail-label">📅 Date</span>
                            <span className="booking-detail-value">
                              {formatDate(booking.booking_date)}
                            </span>
                          </div>
                          <div className="booking-detail">
                            <span className="booking-detail-label">⏰ Time Slot</span>
                            <span className="booking-detail-value">
                              {booking.time_slot}
                            </span>
                          </div>
                          <div className="booking-detail">
                            <span className="booking-detail-label">📌 Booked On</span>
                            <span className="booking-detail-value">
                              {new Date(
                                booking.created_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}

// Chat Page Component
function ChatPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [yearRoom, setYearRoom] = useState(null);
  const [courseRooms, setCourseRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomType, setRoomType] = useState(null); // 'year' or 'course'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [lastMessageId, setLastMessageId] = useState(0);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    loadYearRoom();
    loadCourseRooms();
    return () => {
      // Cleanup on unmount
    };
  }, []);

  useEffect(() => {
    if (currentRoom) {
      const interval = setInterval(() => {
        loadMessages(false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentRoom, lastMessageId]);

  const loadYearRoom = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/rooms`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setYearRoom(data.room);
        // Set as default room if no course rooms
        if (!currentRoom) {
        setCurrentRoom(data.room);
          setRoomType('year');
        setLastMessageId(0);
        await loadMessages(true);
        }
      }
    } catch (error) {
      console.error("Error loading year room:", error);
    }
  };

  const loadCourseRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/course-chatrooms`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCourseRooms(data.chatrooms || []);
        // Set first course room as default if no year room
        if (!currentRoom && data.chatrooms && data.chatrooms.length > 0) {
          setCurrentRoom(data.chatrooms[0]);
          setRoomType('course');
          setLastMessageId(0);
          await loadMessages(true);
        }
      }
    } catch (error) {
      console.error("Error loading course rooms:", error);
    }
  };

  const loadMessages = async (isInitial = false) => {
    if (!currentRoom) return;

    try {
      const url = roomType === 'course'
        ? `${API_BASE_URL}/course-chatrooms/${currentRoom.room_key}/messages`
        : `${API_BASE_URL}/chat/messages/${currentRoom.key}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();

        if (isInitial) {
          setMessages(data.messages);
          if (data.messages.length > 0) {
            setLastMessageId(data.messages[data.messages.length - 1].id);
          }
          setTimeout(scrollToBottom, 100);
        } else {
          const newMsgs = data.messages.filter((msg) => msg.id > lastMessageId);
          if (newMsgs.length > 0) {
            const wasNearBottom = isNearBottom();
            setMessages((prev) => [...prev, ...newMsgs]);
            setLastMessageId(newMsgs[newMsgs.length - 1].id);
            if (wasNearBottom) {
              setTimeout(scrollToBottom, 50);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const isNearBottom = () => {
    if (!chatMessagesRef.current) return true;
    const { scrollHeight, scrollTop, clientHeight } = chatMessagesRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !currentRoom) return;

    try {
      const roomKey = roomType === 'course' ? currentRoom.room_key : currentRoom.key;
      const url = roomType === 'course'
        ? `${API_BASE_URL}/course-chatrooms/${roomKey}/messages`
        : `${API_BASE_URL}/chat/messages`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          room: roomKey,
          content: content,
        }),
      });

      if (response.ok) {
        setNewMessage("");
        await loadMessages(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessages = () => {
    let currentDate = "";
    const elements = [];

    messages.forEach((msg, idx) => {
      if (msg.date !== currentDate) {
        currentDate = msg.date;
        elements.push(
          <div key={`date-${msg.date}`} className="message-date-divider">
            <span>{formatDateDivider(msg.date)}</span>
          </div>
        );
      }

      const isAdmin = msg.sender_id && (msg.sender_id.startsWith("admin_") || msg.sender_id === "admin");
      const isOwn = currentUser && (
        msg.sender_id === currentUser.student_id ||
        (currentUser.role === "admin" && msg.sender_name === currentUser.name)
      );
      const avatar = msg.sender_name.charAt(0).toUpperCase();

      elements.push(
        <div key={msg.id} className={`message-wrapper ${isOwn ? "own" : ""}`}>
          <div className="message-avatar">{avatar}</div>
          <div className="message-content-wrapper">
            {!isOwn && (
              <div className="message-sender-name">
                {msg.sender_name}
                {isAdmin && <span style={{ color: "#3b82f6", marginLeft: "4px" }}>(Admin)</span>}
              </div>
            )}
            {isOwn && currentUser.role === "admin" && (
              <div className="message-sender-name" style={{ color: "#3b82f6" }}>
                You (Administrator)
              </div>
            )}
            <div className="message-bubble">{msg.content}</div>
            <div className="message-time">{formatTime(msg.timestamp)}</div>
          </div>
        </div>
      );
    });

    return elements;
  };

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <Header
        title="SE Chat"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="chat"
      />

      <div className="chat-container" style={{ width: "100%", margin: 0, padding: 0 }}>
        <div style={{ display: "flex", height: "calc(100vh - 180px)", width: "100%" }}>
          {/* Room Selector Sidebar */}
          <div style={{
            width: "280px",
            borderRight: "2px solid rgba(102, 126, 234, 0.1)",
            background: "linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)",
            padding: "1.5rem",
            overflowY: "auto",
            boxShadow: "2px 0 8px rgba(0, 0, 0, 0.05)"
          }}>
            {yearRoom && (
              <>
                <h3 style={{ 
                  marginTop: 0, 
                  marginBottom: "1.25rem", 
                  color: "#1f2937",
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Year Group
                </h3>
                <div
                  onClick={() => {
                    setCurrentRoom(yearRoom);
                    setRoomType('year');
                    setMessages([]);
                    setLastMessageId(0);
                    loadMessages(true);
                  }}
                  style={{
                    padding: "1rem",
                    marginBottom: "1rem",
                    borderRadius: "12px",
                    cursor: "pointer",
                    background: currentRoom?.key === yearRoom.key && roomType === 'year' 
                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                      : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                    border: currentRoom?.key === yearRoom.key && roomType === 'year' 
                      ? "2px solid rgba(255, 255, 255, 0.3)" 
                      : "2px solid #e2e8f0",
                    transition: "all 0.3s ease",
                    boxShadow: currentRoom?.key === yearRoom.key && roomType === 'year'
                      ? "0 4px 12px rgba(102, 126, 234, 0.3)"
                      : "0 2px 4px rgba(0, 0, 0, 0.05)"
                  }}
                  onMouseEnter={(e) => {
                    if (!(currentRoom?.key === yearRoom.key && roomType === 'year')) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(currentRoom?.key === yearRoom.key && roomType === 'year')) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: currentRoom?.key === yearRoom.key && roomType === 'year'
                        ? "rgba(255, 255, 255, 0.2)"
                        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: currentRoom?.key === yearRoom.key && roomType === 'year' ? "#ffffff" : "#ffffff",
                      fontWeight: "700",
                      fontSize: "1.1rem",
                      boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                    }}>
                      {yearRoom.name?.match(/\d+/)?.[0] || 'Y'}
                    </div>
                    <div style={{ 
                      fontWeight: "600", 
                      color: currentRoom?.key === yearRoom.key && roomType === 'year' ? "#ffffff" : "#1f2937",
                      fontSize: "0.95rem"
                    }}>
                      {yearRoom.name}
                    </div>
                  </div>
                </div>
              </>
            )}

            {courseRooms.length > 0 && (
              <>
                <h3 style={{ 
                  marginTop: "2rem", 
                  marginBottom: "1.25rem", 
                  color: "#1f2937",
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Course Chatrooms
                </h3>
                {courseRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => {
                      setCurrentRoom(room);
                      setRoomType('course');
                      setMessages([]);
                      setLastMessageId(0);
                      loadMessages(true);
                    }}
                    style={{
                      padding: "1rem",
                      marginBottom: "0.75rem",
                      borderRadius: "12px",
                      cursor: "pointer",
                      background: currentRoom?.room_key === room.room_key && roomType === 'course'
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                      border: currentRoom?.room_key === room.room_key && roomType === 'course'
                        ? "2px solid rgba(255, 255, 255, 0.3)"
                        : "2px solid #e2e8f0",
                      transition: "all 0.3s ease",
                      boxShadow: currentRoom?.room_key === room.room_key && roomType === 'course'
                        ? "0 4px 12px rgba(102, 126, 234, 0.3)"
                        : "0 2px 4px rgba(0, 0, 0, 0.05)",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      if (!(currentRoom?.room_key === room.room_key && roomType === 'course')) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(currentRoom?.room_key === room.room_key && roomType === 'course')) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: currentRoom?.room_key === room.room_key && roomType === 'course'
                          ? "rgba(255, 255, 255, 0.2)"
                          : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                      }}>
                        {room.course_code?.charAt(0) || 'C'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: "600", 
                          color: currentRoom?.room_key === room.room_key && roomType === 'course' ? "#ffffff" : "#1f2937", 
                          fontSize: "0.95rem" 
                        }}>
                          {room.course_code}
                        </div>
                        <div style={{ 
                          fontSize: "0.8rem", 
                          color: currentRoom?.room_key === room.room_key && roomType === 'course' ? "rgba(255, 255, 255, 0.9)" : "#64748b", 
                          marginTop: "2px" 
                        }}>
                          {room.course_title}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Chat Main Area */}
          <div className="chat-main" style={{ flex: 1 }}>
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="room-avatar">
                  {currentRoom ? (roomType === 'course' ? currentRoom.course_code?.charAt(0) || 'C' : currentRoom.name?.charAt(0) || 'Y') : 'C'}
              </div>
              <div>
                  <h2>
                    {currentRoom 
                      ? (roomType === 'course' 
                          ? `${currentRoom.course_code} - ${currentRoom.course_title}`
                          : currentRoom.name)
                      : "Loading..."}
                  </h2>
                  {roomType === 'course' && (
                    <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.9)", marginTop: "4px", fontWeight: "500" }}>
                      Course Chatroom
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="chat-messages" ref={chatMessagesRef}>
            {messages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "#65676b",
                }}
              >
                No messages yet. Start the conversation!
              </div>
            ) : (
              <>
                {renderMessages()}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
            />
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin Chat Page Component
function AdminChatPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [yearRooms, setYearRooms] = useState([]);
  const [courseRooms, setCourseRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomType, setRoomType] = useState(null); // 'year' or 'course'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [lastMessageId, setLastMessageId] = useState(0);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    loadYearRooms();
    loadCourseRooms();
    return () => {
      // Cleanup on unmount
    };
  }, []);

  useEffect(() => {
    if (currentRoom) {
      const interval = setInterval(() => {
        loadMessages(false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentRoom, lastMessageId]);

  const loadYearRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/chat/rooms`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setYearRooms(data.rooms);
      }
    } catch (error) {
      console.error("Error loading year rooms:", error);
    }
  };

  const loadCourseRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/course-chatrooms`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCourseRooms(data.chatrooms || []);
      }
    } catch (error) {
      console.error("Error loading course rooms:", error);
    }
  };

  const loadMessages = async (isInitial = false) => {
    if (!currentRoom) return;

    try {
      const url = roomType === 'course' 
        ? `${API_BASE_URL}/course-chatrooms/${currentRoom.room_key}/messages`
        : `${API_BASE_URL}/admin/chat/messages/${currentRoom.key}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();

        if (isInitial) {
          setMessages(data.messages);
          if (data.messages.length > 0) {
            setLastMessageId(data.messages[data.messages.length - 1].id);
          }
          setTimeout(scrollToBottom, 100);
        } else {
          // For updates, check for new messages
          const newMsgs = data.messages.filter((msg) => msg.id > lastMessageId);
          if (newMsgs.length > 0) {
            const wasNearBottom = isNearBottom();
            setMessages((prev) => {
              // Combine previous messages with new ones, avoiding duplicates
              const existingIds = new Set(prev.map(m => m.id));
              const uniqueNewMsgs = newMsgs.filter(m => !existingIds.has(m.id));
              return [...prev, ...uniqueNewMsgs];
            });
            setLastMessageId(newMsgs[newMsgs.length - 1].id);
            if (wasNearBottom) {
              setTimeout(scrollToBottom, 50);
            }
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        console.error("Failed to load messages:", response.status, errorData);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleRoomChange = async (room, type) => {
    setCurrentRoom(room);
    setRoomType(type);
    setMessages([]);
    setLastMessageId(0);
    await loadMessages(true);
  };

  const handleDeleteCourseRoom = async (roomKey) => {
    if (!window.confirm("Are you sure you want to delete this course chatroom? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/course-chatrooms/${roomKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        // Reload course rooms
        await loadCourseRooms();
        // Clear current room if it was the deleted one
        if (currentRoom && currentRoom.room_key === roomKey) {
          setCurrentRoom(null);
          setMessages([]);
        }
        alert("Chatroom deleted successfully");
      } else {
        const error = await response.json();
        alert(`Failed to delete chatroom: ${error.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting chatroom:", error);
      alert(`Error deleting chatroom: ${error.message}`);
    }
  };

  const isNearBottom = () => {
    if (!chatMessagesRef.current) return true;
    const { scrollHeight, scrollTop, clientHeight } = chatMessagesRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !currentRoom) {
      console.warn("Cannot send message: missing content or room");
      return;
    }

    // Disable input while sending
    const originalMessage = newMessage;
    setNewMessage("");

    try {
      const roomKey = roomType === 'course' ? currentRoom.room_key : currentRoom.key;
      const requestBody = {
        room: roomKey,
        content: content,
      };
      
      console.log("Sending message:", requestBody);
      
      const url = roomType === 'course'
        ? `${API_BASE_URL}/course-chatrooms/${roomKey}/messages`
        : `${API_BASE_URL}/admin/chat/messages`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("Message sent successfully:", result);
        // Reload all messages to ensure we have the latest
        await loadMessages(true);
        setTimeout(scrollToBottom, 100);
      } else {
        // Restore the message if sending failed
        setNewMessage(originalMessage);
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        console.error("Failed to send message:", response.status, errorData);
        alert(`Failed to send message: ${errorData.detail || "Unknown error"}`);
      }
    } catch (error) {
      // Restore the message if sending failed
      setNewMessage(originalMessage);
      console.error("Error sending message:", error);
      alert(`Error sending message: ${error.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessages = () => {
    let currentDate = "";
    const elements = [];

    messages.forEach((msg, idx) => {
      if (msg.date !== currentDate) {
        currentDate = msg.date;
        elements.push(
          <div key={`date-${msg.date}`} className="message-date-divider">
            <span>{formatDateDivider(msg.date)}</span>
          </div>
        );
      }

      const isAdmin = msg.sender_id && (msg.sender_id.startsWith("admin_") || msg.sender_id === "admin");
      // Check if this message is from the current admin user
      // For admin, check by name match since admin might not have student_id
      const isOwn = currentUser && currentUser.role === "admin" && (
        msg.sender_name === currentUser.name ||
        (currentUser.student_id && msg.sender_id === currentUser.student_id) ||
        (currentUser.id && msg.sender_id === `admin_${currentUser.id}`)
      );
      const avatar = msg.sender_name.charAt(0).toUpperCase();

      elements.push(
        <div key={msg.id} className={`message-wrapper ${isOwn ? "own" : ""}`}>
          <div className="message-avatar">{avatar}</div>
          <div className="message-content-wrapper">
            {!isOwn && (
              <div className="message-sender-name">
                {msg.sender_name}
                {isAdmin && <span style={{ color: "#3b82f6", marginLeft: "4px" }}>(Admin)</span>}
              </div>
            )}
            {isOwn && (
              <div className="message-sender-name" style={{ color: "#3b82f6" }}>
                You (Administrator)
              </div>
            )}
            <div className="message-bubble">{msg.content}</div>
            <div className="message-time">{formatTime(msg.timestamp)}</div>
          </div>
        </div>
      );
    });

    return elements;
  };

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <Header
        title="Admin Chatrooms"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="admin-chat"
      />

      <div className="chat-container" style={{ width: "100%", margin: 0, padding: 0 }}>
        <div style={{ display: "flex", height: "calc(100vh - 180px)", width: "100%" }}>
          {/* Room Selector Sidebar */}
          <div style={{
            width: "320px",
            borderRight: "2px solid rgba(102, 126, 234, 0.1)",
            background: "linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)",
            padding: "1.5rem",
            overflowY: "auto",
            boxShadow: "2px 0 8px rgba(0, 0, 0, 0.05)"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "1.25rem", 
              color: "#1f2937",
              fontSize: "1.1rem",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Year Groups
            </h3>
            {yearRooms.map((room) => (
              <div
                key={room.key}
                onClick={() => handleRoomChange(room, 'year')}
                style={{
                  padding: "1rem",
                  marginBottom: "0.75rem",
                  borderRadius: "12px",
                  cursor: "pointer",
                  background: currentRoom?.key === room.key && roomType === 'year'
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                  border: currentRoom?.key === room.key && roomType === 'year'
                    ? "2px solid rgba(255, 255, 255, 0.3)"
                    : "2px solid #e2e8f0",
                  transition: "all 0.3s ease",
                  boxShadow: currentRoom?.key === room.key && roomType === 'year'
                    ? "0 4px 12px rgba(102, 126, 234, 0.3)"
                    : "0 2px 4px rgba(0, 0, 0, 0.05)"
                }}
                onMouseEnter={(e) => {
                  if (!(currentRoom?.key === room.key && roomType === 'year')) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(currentRoom?.key === room.key && roomType === 'year')) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: currentRoom?.key === room.key && roomType === 'year'
                      ? "rgba(255, 255, 255, 0.2)"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontWeight: "700",
                    fontSize: "1.1rem",
                    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                  }}>
                    {room.name?.match(/\d+/)?.[0] || 'Y'}
                  </div>
                  <div>
                    <div style={{ 
                      fontWeight: "600", 
                      color: currentRoom?.key === room.key && roomType === 'year' ? "#ffffff" : "#1f2937",
                      fontSize: "0.95rem"
                    }}>
                      {room.name}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <h3 style={{ marginTop: "2rem", marginBottom: "1rem", color: "#1c1e21" }}>
              Course Chatrooms
            </h3>
            {courseRooms.length === 0 ? (
              <div style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem", textAlign: "center", fontStyle: "italic" }}>
                No course chatrooms yet
              </div>
            ) : (
              courseRooms.map((room) => (
                <div
                  key={room.id}
                  style={{
                    padding: "1rem",
                    marginBottom: "0.75rem",
                    borderRadius: "12px",
                    background: currentRoom?.room_key === room.room_key && roomType === 'course'
                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                      : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                    border: currentRoom?.room_key === room.room_key && roomType === 'course'
                      ? "2px solid rgba(255, 255, 255, 0.3)"
                      : "2px solid #e2e8f0",
                    transition: "all 0.3s ease",
                    boxShadow: currentRoom?.room_key === room.room_key && roomType === 'course'
                      ? "0 4px 12px rgba(102, 126, 234, 0.3)"
                      : "0 2px 4px rgba(0, 0, 0, 0.05)",
                    position: "relative"
                  }}
                >
                  <div
                    onClick={() => handleRoomChange(room, 'course')}
                    style={{
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => {
                      if (!(currentRoom?.room_key === room.room_key && roomType === 'course')) {
                        e.currentTarget.parentElement.style.transform = "translateY(-2px)";
                        e.currentTarget.parentElement.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(currentRoom?.room_key === room.room_key && roomType === 'course')) {
                        e.currentTarget.parentElement.style.transform = "translateY(0)";
                        e.currentTarget.parentElement.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: currentRoom?.room_key === room.room_key && roomType === 'course'
                          ? "rgba(255, 255, 255, 0.2)"
                          : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                      }}>
                        {room.course_code?.charAt(0) || 'C'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: "600", 
                          color: currentRoom?.room_key === room.room_key && roomType === 'course' ? "#ffffff" : "#1f2937", 
                          fontSize: "0.95rem" 
                        }}>
                          {room.course_code}
                        </div>
                        <div style={{ 
                          fontSize: "0.8rem", 
                          color: currentRoom?.room_key === room.room_key && roomType === 'course' ? "rgba(255, 255, 255, 0.9)" : "#64748b", 
                          marginTop: "2px" 
                        }}>
                          {room.course_title}
                        </div>
                        {room.user_role === 'admin' && (
                          <div style={{ 
                            fontSize: "0.75rem", 
                            color: currentRoom?.room_key === room.room_key && roomType === 'course' ? "rgba(255, 255, 255, 0.9)" : "#667eea", 
                            marginTop: "4px",
                            fontWeight: "600"
                          }}>
                            Admin
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {room.user_role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCourseRoom(room.room_key);
                      }}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        border: "none",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        padding: "0.4rem 0.7rem",
                        borderRadius: "8px",
                        fontWeight: "600",
                        boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                        transition: "all 0.2s ease"
                      }}
                      title="Delete chatroom"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.3)";
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Chat Main Area */}
          <div className="chat-main" style={{ flex: 1 }}>
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="room-avatar">
                  {currentRoom ? (roomType === 'course' ? currentRoom.course_code?.charAt(0) || 'C' : currentRoom.name?.charAt(0) || 'Y') : 'A'}
                </div>
                <div>
                  <h2>
                    {currentRoom 
                      ? (roomType === 'course' 
                          ? `${currentRoom.course_code} - ${currentRoom.course_title}`
                          : currentRoom.name)
                      : "Select a room"}
                  </h2>
                  <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.9)", marginTop: "4px", fontWeight: "500" }}>
                    {roomType === 'course' ? "Course Chatroom" : "Administrator View"}
                  </div>
                </div>
              </div>
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {messages.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#65676b",
                  }}
                >
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <>
                  {renderMessages()}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="chat-input-container">
              <input
                type="text"
                className="chat-input"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message as administrator..."
              />
              <button
                className="send-btn"
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header Component
function Header({ title, currentUser, onLogout, onNavigate, activePage }) {
  const [open, setOpen] = React.useState(false);

  const toggle = () => setOpen((o) => !o);

  return (
    <header className="main-header">
      <div className="header-container">
        {/* Page Title */}
        <h1 className="welcome">{title}</h1>

        {/* Navigation and User Section */}
        {currentUser && (
          <div className="header-right">
            <nav className="main-nav">
              {currentUser.role === "admin" ? (
                <>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "admin-dashboard" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("admin-dashboard");
                    }}
                  >
                    Dashboard
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "admin-registrations" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("admin-registrations");
                    }}
                  >
                    Registrations
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "admin-grading" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("admin-grading");
                    }}
                  >
                    Grading
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "admin-courses" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("admin-courses");
                    }}
                  >
                    Courses
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "admin-attendance" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("admin-attendance");
                    }}
                  >
                    Calendar
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "admin-chat" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("admin-chat");
                    }}
                  >
                    Chatrooms
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "booking" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("booking");
                    }}
                  >
                    Booking
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "chat" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("chat");
                    }}
                  >
                    ChatRoom
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "curriculum" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("curriculum");
                    }}
                  >
                    Curriculum
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "credit" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("credit");
                    }}
                  >
                    Credit
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "gpa" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("gpa");
                    }}
                  >
                    Transcript
                  </a>
                  <a
                    href="#"
                    className={`nav-link ${activePage === "contact" ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate("contact");
                    }}
                  >
                    Contact
                  </a>
                </>
              )}
            </nav>

            {/* User Profile Section - Separated */}
            <div className="user-section">
              <div className="user-menu">
                <div className="profile-wrapper">
                  <button
                    className="user-display"
                    onClick={(e) => {
                      e.preventDefault();
                      toggle();
                    }}
                    title={`Account: ${currentUser.name}`}
                  >
                    <span className="user-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </span>
                    <span className="user-info">
                      <span className="user-name">{currentUser.name}</span>
                      <span className="user-year">
                        {currentUser.role === "admin" ? "Administrator" : `Year ${currentUser.year}`}
                      </span>
                    </span>
                    <span className="dropdown-arrow">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </button>
                  {open && (
                    <div className="profile-dropdown">
                      <div className="dropdown-header">
                        <div className="dropdown-avatar">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                        </div>
                        <div className="dropdown-user-info">
                          <span className="dropdown-user-name">{currentUser.name}</span>
                          <span className="dropdown-user-year">
                            {currentUser.role === "admin" ? "Administrator" : `Year ${currentUser.year} Student`}
                          </span>
                        </div>
                      </div>
                      <div className="dropdown-divider"></div>
                      <div className="dropdown-actions">
                        <button
                          className="dropdown-menu-item"
                          onClick={() => {
                            setOpen(false);
                            onNavigate("profile");
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <span>Profile</span>
                        </button>
                        {currentUser.role !== "admin" && (
                          <button
                            className="dropdown-menu-item"
                            onClick={() => {
                              setOpen(false);
                              onNavigate("notifications");
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            <span>Notifications</span>
                          </button>
                        )}
                        <button
                          className="dropdown-menu-item logout-item"
                          onClick={() => {
                            setOpen(false);
                            onLogout();
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// Admin Dashboard Page
function AdminDashboardPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [bookingStats, setBookingStats] = useState(null);
  const [chatStats, setChatStats] = useState(null);
  const [gpaStats, setGpaStats] = useState(null);
  const [creditStats, setCreditStats] = useState(null);
  const [activityStats, setActivityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("daily"); // daily, weekly, monthly

  useEffect(() => {
    if (authToken && currentUser?.role === "admin") {
      // Fetch all analytics data with individual error handling
      const fetchWithErrorHandling = async (url, name) => {
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (response.ok) {
            return await response.json();
          } else {
            console.error(`Failed to fetch ${name}:`, response.status, response.statusText);
            return null;
          }
        } catch (error) {
          console.error(`Error fetching ${name}:`, error);
          return null;
        }
      };

      Promise.allSettled([
        fetchWithErrorHandling(`${API_BASE_URL}/dashboard/stats`, "stats"),
        fetchWithErrorHandling(`${API_BASE_URL}/dashboard/booking-stats`, "booking-stats"),
        fetchWithErrorHandling(`${API_BASE_URL}/dashboard/chat-stats`, "chat-stats"),
        fetchWithErrorHandling(`${API_BASE_URL}/dashboard/gpa-stats`, "gpa-stats"),
        fetchWithErrorHandling(`${API_BASE_URL}/dashboard/credit-stats`, "credit-stats"),
        fetchWithErrorHandling(`${API_BASE_URL}/dashboard/user-activity`, "user-activity"),
      ])
        .then((results) => {
          const [statsResult, bookingResult, chatResult, gpaResult, creditResult, activityResult] = results;
          
          if (statsResult.status === "fulfilled" && statsResult.value) {
            setStats(statsResult.value);
          }
          if (bookingResult.status === "fulfilled" && bookingResult.value) {
            setBookingStats(bookingResult.value);
          }
          if (chatResult.status === "fulfilled" && chatResult.value) {
            setChatStats(chatResult.value);
          }
          if (gpaResult.status === "fulfilled" && gpaResult.value) {
            setGpaStats(gpaResult.value);
          }
          if (creditResult.status === "fulfilled" && creditResult.value) {
            setCreditStats(creditResult.value);
          }
          if (activityResult.status === "fulfilled" && activityResult.value) {
            setActivityStats(activityResult.value);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load stats:", err);
          setLoading(false);
        });
    } else {
      onNavigate("booking");
    }
  }, [authToken, currentUser, onNavigate]);

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"];

  return (
    <div className="page-container">
      <Header
        title="Admin Dashboard"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="admin-dashboard"
      />
      <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#3b82f6" }}>Total Students</h3>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.total_students || 0}</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#f59e0b" }}>Pending Registrations</h3>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.pending_registrations || 0}</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#10b981" }}>Approved Courses</h3>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.approved_courses || 0}</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#8b5cf6" }}>Total Courses</h3>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.total_courses || 0}</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#ec4899" }}>Students with Grades</h3>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.students_with_grades || 0}</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#10b981" }}>Average GPA</h3>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{gpaStats?.average_gpa?.toFixed(2) || "0.00"}</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          {/* Booking Statistics */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3>Total Bookings</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setTimeRange("daily")}
                  style={{
                    padding: "0.25rem 0.75rem",
                    background: timeRange === "daily" ? "#3b82f6" : "#e5e7eb",
                    color: timeRange === "daily" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Daily
                </button>
                <button
                  onClick={() => setTimeRange("weekly")}
                  style={{
                    padding: "0.25rem 0.75rem",
                    background: timeRange === "weekly" ? "#3b82f6" : "#e5e7eb",
                    color: timeRange === "weekly" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTimeRange("monthly")}
                  style={{
                    padding: "0.25rem 0.75rem",
                    background: timeRange === "monthly" ? "#3b82f6" : "#e5e7eb",
                    color: timeRange === "monthly" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Monthly
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingStats?.[timeRange] || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={timeRange === "daily" ? "date" : timeRange === "weekly" ? "week" : "month"} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Most Booked Rooms */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Most Booked Rooms</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bookingStats?.most_booked_rooms || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="room_name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chat Activity */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Chat Activity Stats</h3>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#8b5cf6" }}>
                {chatStats?.total_messages || 0}
              </div>
              <div style={{ color: "#6b7280" }}>Total Messages</div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chatStats?.messages_by_room || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="room" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* GPA Distribution */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>GPA Distribution</h3>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>
                {gpaStats?.students_with_gpa || 0} Students
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gpaStats?.gpa_distribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Semester Credit Usage */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Semester Credit Usage</h3>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#f59e0b" }}>
                {creditStats?.total_credits || 0} Total Credits
              </div>
              <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                Avg: {creditStats?.average_credits_per_student?.toFixed(1) || "0.0"} per student
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={creditStats?.credits_by_semester || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="credits" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* User Activity */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>User Activity</h3>
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ec4899" }}>
                {activityStats?.total_active_users || 0} Active Users
              </div>
              <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Last 30 days</div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={activityStats?.new_users_by_date || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              className="submit-btn"
              onClick={() => onNavigate("admin-registrations")}
              style={{ flex: "1 1 200px" }}
            >
              Manage Registrations
            </button>
            <button
              className="submit-btn"
              onClick={() => onNavigate("admin-grading")}
              style={{ flex: "1 1 200px", background: "#10b981" }}
            >
              Enter Grades
            </button>
            <button
              className="submit-btn"
              onClick={() => onNavigate("admin-courses")}
              style={{ flex: "1 1 200px", background: "#8b5cf6" }}
            >
              Manage Courses
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin Registrations Page
function AdminRegistrationsPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [registrations, setRegistrations] = useState([]);
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authToken && currentUser?.role === "admin") {
      loadAllRegistrations();
    } else {
      onNavigate("booking");
    }
  }, [authToken, currentUser, onNavigate]);

  useEffect(() => {
    filterRegistrations();
  }, [filter, allRegistrations]);

  const loadAllRegistrations = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE_URL}/course-registrations?status=pending`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      fetch(`${API_BASE_URL}/course-registrations?status=approved`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      fetch(`${API_BASE_URL}/course-registrations?status=rejected`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    ])
      .then((responses) => Promise.all(responses.map((r) => r.json())))
      .then(([pending, approved, rejected]) => {
        const all = [...pending, ...approved, ...rejected];
        setAllRegistrations(all);
        filterRegistrations(all);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load registrations:", err);
        setLoading(false);
      });
  };

  const filterRegistrations = (data = allRegistrations) => {
    let filtered = data.filter((r) => r.status === filter);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.student_student_id?.toLowerCase().includes(query) ||
          r.student_name?.toLowerCase().includes(query) ||
          r.course_code?.toLowerCase().includes(query) ||
          r.course_title?.toLowerCase().includes(query)
      );
    }
    setRegistrations(filtered);
  };

  useEffect(() => {
    filterRegistrations();
  }, [searchQuery]);

  const handleApproveReject = async (registrationId, status) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/course-registrations/${registrationId}?status=${status}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (response.ok) {
        loadAllRegistrations();
      } else {
        alert("Failed to update registration");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const stats = {
    pending: allRegistrations.filter((r) => r.status === "pending").length,
    approved: allRegistrations.filter((r) => r.status === "approved").length,
    rejected: allRegistrations.filter((r) => r.status === "rejected").length,
    total: allRegistrations.length,
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-screen">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header
        title="Course Registrations"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="admin-registrations"
      />
      <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header Section */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
              Course Registrations
            </h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>
              Manage and review student course registration requests
            </p>
          </div>
          <button
            onClick={() => onNavigate("admin-dashboard")}
            style={{
              padding: "0.625rem 1.25rem",
              background: "#f3f4f6",
              color: "#374151",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#e5e7eb")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#f3f4f6")}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              border: "1px solid #fbbf24",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>⏳</div>
              <div style={{ fontSize: "0.875rem", color: "#92400e", fontWeight: "600" }}>PENDING</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#78350f" }}>{stats.pending}</div>
            <div style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.25rem" }}>Awaiting Review</div>
          </div>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
              border: "1px solid #10b981",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>✓</div>
              <div style={{ fontSize: "0.875rem", color: "#065f46", fontWeight: "600" }}>APPROVED</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#064e3b" }}>{stats.approved}</div>
            <div style={{ fontSize: "0.75rem", color: "#065f46", marginTop: "0.25rem" }}>Successfully Approved</div>
          </div>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
              border: "1px solid #ef4444",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>✗</div>
              <div style={{ fontSize: "0.875rem", color: "#991b1b", fontWeight: "600" }}>REJECTED</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#7f1d1d" }}>{stats.rejected}</div>
            <div style={{ fontSize: "0.75rem", color: "#991b1b", marginTop: "0.25rem" }}>Not Approved</div>
          </div>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
              border: "1px solid #3b82f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>📊</div>
              <div style={{ fontSize: "0.875rem", color: "#1e40af", fontWeight: "600" }}>TOTAL</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1e3a8a" }}>{stats.total}</div>
            <div style={{ fontSize: "0.75rem", color: "#1e40af", marginTop: "0.25rem" }}>All Registrations</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Filter Buttons */}
            <div style={{ display: "flex", gap: "0.5rem", flex: "1", minWidth: "300px" }}>
              <button
                onClick={() => setFilter("pending")}
                style={{
                  padding: "0.625rem 1.25rem",
                  background: filter === "pending" ? "#f59e0b" : "#f3f4f6",
                  color: filter === "pending" ? "white" : "#374151",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  boxShadow: filter === "pending" ? "0 4px 6px rgba(245, 158, 11, 0.3)" : "none",
                }}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setFilter("approved")}
                style={{
                  padding: "0.625rem 1.25rem",
                  background: filter === "approved" ? "#10b981" : "#f3f4f6",
                  color: filter === "approved" ? "white" : "#374151",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  boxShadow: filter === "approved" ? "0 4px 6px rgba(16, 185, 129, 0.3)" : "none",
                }}
              >
                Approved ({stats.approved})
              </button>
              <button
                onClick={() => setFilter("rejected")}
                style={{
                  padding: "0.625rem 1.25rem",
                  background: filter === "rejected" ? "#ef4444" : "#f3f4f6",
                  color: filter === "rejected" ? "white" : "#374151",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  boxShadow: filter === "rejected" ? "0 4px 6px rgba(239, 68, 68, 0.3)" : "none",
                }}
              >
                Rejected ({stats.rejected})
              </button>
            </div>
            {/* Search Bar */}
            <div style={{ position: "relative", flex: "1", minWidth: "250px", maxWidth: "400px" }}>
              <input
                type="text"
                placeholder="Search by student ID, name, or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem 2.5rem 0.625rem 1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
              />
              <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                🔍
              </span>
            </div>
          </div>
        </div>

        {/* Registrations Table */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          {registrations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📋</div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#374151", fontSize: "1.25rem" }}>No registrations found</h3>
              <p style={{ margin: 0, color: "#6b7280" }}>
                {searchQuery ? "Try adjusting your search query" : `No ${filter} registrations at the moment`}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Student
                    </th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Course
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Credits
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Semester
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Year
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Status
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg, index) => (
                    <tr
                      key={reg.id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                    >
                      <td style={{ padding: "1rem" }}>
                        <div>
                          <div style={{ fontWeight: "600", color: "#1f2937", marginBottom: "0.25rem" }}>
                            {reg.student_student_id}
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{reg.student_name}</div>
                        </div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div>
                          <div style={{ fontWeight: "600", color: "#3b82f6", marginBottom: "0.25rem" }}>
                            {reg.course_code}
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: "300px" }}>{reg.course_title}</div>
                        </div>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.75rem",
                            background: "#dbeafe",
                            color: "#1e40af",
                            borderRadius: "9999px",
                            fontWeight: "600",
                            fontSize: "0.875rem",
                          }}
                        >
                          {reg.course_credits}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center", color: "#374151", fontWeight: "500" }}>
                        {reg.semester}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center", color: "#374151", fontWeight: "500" }}>
                        {reg.year}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.375rem 0.875rem",
                            borderRadius: "9999px",
                            fontWeight: "600",
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            background:
                              reg.status === "approved"
                                ? "#d1fae5"
                                : reg.status === "rejected"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              reg.status === "approved"
                                ? "#065f46"
                                : reg.status === "rejected"
                                ? "#991b1b"
                                : "#92400e",
                          }}
                        >
                          {reg.status === "approved" ? "✓ " : reg.status === "rejected" ? "✗ " : "⏳ "}
                          {reg.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        {reg.status === "pending" && (
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                            <button
                              onClick={() => handleApproveReject(reg.id, "approved")}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "0.375rem",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "0.875rem",
                                transition: "all 0.2s",
                                boxShadow: "0 2px 4px rgba(16, 185, 129, 0.2)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#059669";
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 4px 6px rgba(16, 185, 129, 0.3)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#10b981";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.2)";
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleApproveReject(reg.id, "rejected")}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "0.375rem",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "0.875rem",
                                transition: "all 0.2s",
                                boxShadow: "0 2px 4px rgba(239, 68, 68, 0.2)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#dc2626";
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 4px 6px rgba(239, 68, 68, 0.3)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#ef4444";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 4px rgba(239, 68, 68, 0.2)";
                              }}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        )}
                        {reg.status !== "pending" && (
                          <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Admin Grading Page
function AdminGradingPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [grade, setGrade] = useState("");
  const [semester, setSemester] = useState("1");
  const [year, setYear] = useState(new Date().getFullYear());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authToken && currentUser?.role === "admin") {
      fetch(`${API_BASE_URL}/students`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => setStudents(data))
        .catch((err) => console.error("Failed to load students:", err));

      fetch(`${API_BASE_URL}/courses`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => setCourses(data))
        .catch((err) => console.error("Failed to load courses:", err));
    } else {
      onNavigate("booking");
    }
  }, [authToken, currentUser, onNavigate]);

  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !selectedCourse || !grade) {
      setMessage("Please fill all fields");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/grades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          student_id: selectedStudent,
          course_id: selectedCourse,
          grade: grade,
          semester: semester,
          year: parseInt(year),
        }),
      });

      if (response.ok) {
        setMessage("Grade submitted successfully!");
        setGrade("");
      } else {
        const error = await response.json();
        setMessage(error.detail || "Failed to submit grade");
      }
    } catch (error) {
      setMessage("Error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <Header
        title="Grading System"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="admin-grading"
      />
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <button
          className="submit-btn"
          onClick={() => onNavigate("admin-dashboard")}
          style={{ marginBottom: "1rem" }}
        >
          Back to Dashboard
        </button>
        <div className="card">
          <h2>Enter Grade</h2>
          {message && (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "4px",
                marginBottom: "1rem",
                background: message.includes("successfully") ? "#d1fae5" : "#fee2e2",
                color: message.includes("successfully") ? "#065f46" : "#991b1b",
              }}
            >
              {message}
            </div>
          )}
          <form onSubmit={handleSubmitGrade}>
            <div style={{ marginBottom: "1rem" }}>
              <label>Student</label>
              <select
                value={selectedStudent || ""}
                onChange={(e) => setSelectedStudent(parseInt(e.target.value))}
                style={{ width: "100%", padding: "0.5rem" }}
                required
              >
                <option value="">Select Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.student_id} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label>Course</label>
              <select
                value={selectedCourse || ""}
                onChange={(e) => setSelectedCourse(parseInt(e.target.value))}
                style={{ width: "100%", padding: "0.5rem" }}
                required
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label>Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                style={{ width: "100%", padding: "0.5rem" }}
                required
              >
                <option value="">Select Grade</option>
                <option value="A">A</option>
                <option value="B+">B+</option>
                <option value="B">B</option>
                <option value="C+">C+</option>
                <option value="C">C</option>
                <option value="D+">D+</option>
                <option value="D">D</option>
                <option value="F">F</option>
              </select>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Semester</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setSemester("1")}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    border: "2px solid",
                    borderColor: semester === "1" ? "#3b82f6" : "#e5e7eb",
                    borderRadius: "0.5rem",
                    background: semester === "1" ? "#eff6ff" : "#ffffff",
                    color: semester === "1" ? "#3b82f6" : "#374151",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontSize: "0.875rem",
                  }}
                  onMouseEnter={(e) => {
                    if (semester !== "1") {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.background = "#f0f9ff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (semester !== "1") {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.background = "#ffffff";
                    }
                  }}
                >
                  Semester 1
                </button>
                <button
                  type="button"
                  onClick={() => setSemester("2")}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    border: "2px solid",
                    borderColor: semester === "2" ? "#3b82f6" : "#e5e7eb",
                    borderRadius: "0.5rem",
                    background: semester === "2" ? "#eff6ff" : "#ffffff",
                    color: semester === "2" ? "#3b82f6" : "#374151",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontSize: "0.875rem",
                  }}
                  onMouseEnter={(e) => {
                    if (semester !== "2") {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.background = "#f0f9ff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (semester !== "2") {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.background = "#ffffff";
                    }
                  }}
                >
                  Semester 2
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label>Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                style={{ width: "100%", padding: "0.5rem" }}
                required
              />
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={submitting}
              style={{ width: "100%" }}
            >
              {submitting ? "Submitting..." : "Submit Grade"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Admin Calendar Page (Attendance & Events)
function AdminAttendancePage({ currentUser, authToken, onLogout, onNavigate }) {
  const [mode, setMode] = useState("attendance"); // "attendance" or "event"
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [eventAttendanceRecords, setEventAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState({ courses: true, sessions: true, events: true, records: false });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    course_id: "",
    event_name: "",
    session_date: new Date().toISOString().split('T')[0],
    event_date: new Date().toISOString().split('T')[0],
    time_slot: "",
  });

  useEffect(() => {
    if (authToken && currentUser?.role === "admin") {
      loadCourses();
      loadSessions();
      loadEvents();
    } else {
      onNavigate("booking");
    }
  }, [authToken, currentUser, onNavigate]);

  const loadCourses = () => {
    setLoading(prev => ({ ...prev, courses: true }));
    fetch(`${API_BASE_URL}/courses`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);
        setLoading(prev => ({ ...prev, courses: false }));
      })
      .catch((err) => {
        console.error("Failed to load courses:", err);
        setLoading(prev => ({ ...prev, courses: false }));
      });
  };

  const loadSessions = () => {
    setLoading(prev => ({ ...prev, sessions: true }));
    fetch(`${API_BASE_URL}/attendance/sessions`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setSessions(data);
        setLoading(prev => ({ ...prev, sessions: false }));
      })
      .catch((err) => {
        console.error("Failed to load sessions:", err);
        setLoading(prev => ({ ...prev, sessions: false }));
      });
  };

  const loadEvents = () => {
    setLoading(prev => ({ ...prev, events: true }));
    fetch(`${API_BASE_URL}/events`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoading(prev => ({ ...prev, events: false }));
      })
      .catch((err) => {
        console.error("Failed to load events:", err);
        setLoading(prev => ({ ...prev, events: false }));
      });
  };

  const loadEventAttendanceRecords = async (eventId, silent = false) => {
    if (!silent) {
      setLoading(prev => ({ ...prev, records: true }));
    }
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/attendance`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEventAttendanceRecords(data);
        setSelectedEvent(eventId);
      }
    } catch (error) {
      console.error("Failed to load event attendance records:", error);
    } finally {
      if (!silent) {
        setLoading(prev => ({ ...prev, records: false }));
      }
    }
  };

  // Auto-refresh event attendance records when an event is selected
  useEffect(() => {
    if (selectedEvent && authToken && mode === "event") {
      loadEventAttendanceRecords(selectedEvent, false);
      
      const interval = setInterval(() => {
        if (selectedEvent && authToken) {
          loadEventAttendanceRecords(selectedEvent, true);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [selectedEvent, authToken, mode]);

  const loadAttendanceRecords = async (sessionId, silent = false) => {
    if (!silent) {
      setLoading(prev => ({ ...prev, records: true }));
    }
    try {
      const response = await fetch(`${API_BASE_URL}/attendance/sessions/${sessionId}/records`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAttendanceRecords(data);
        setSelectedSession(sessionId);
      }
    } catch (error) {
      console.error("Failed to load attendance records:", error);
    } finally {
      if (!silent) {
        setLoading(prev => ({ ...prev, records: false }));
      }
    }
  };

  // Auto-refresh attendance records when a session is selected
  useEffect(() => {
    if (selectedSession && authToken) {
      // Refresh immediately (with loading indicator)
      loadAttendanceRecords(selectedSession, false);
      
      // Set up polling to refresh every 3 seconds (silent - no loading indicator)
      const interval = setInterval(() => {
        if (selectedSession && authToken) {
          loadAttendanceRecords(selectedSession, true);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [selectedSession, authToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === "attendance") {
      const response = await fetch(`${API_BASE_URL}/attendance/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          course_id: parseInt(formData.course_id),
          session_date: formData.session_date,
          time_slot: formData.time_slot,
        }),
      });

      if (response.ok) {
        loadSessions();
        setShowForm(false);
        setFormData({
            ...formData,
          course_id: "",
          session_date: new Date().toISOString().split('T')[0],
          time_slot: "",
        });
        alert("Attendance session created successfully! Students will receive notifications.");
      } else {
        const error = await response.json();
        alert(error.detail || "Failed to create attendance session");
        }
      } else {
        // Event mode
        const response = await fetch(`${API_BASE_URL}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            event_name: formData.event_name,
            event_date: formData.event_date,
            time_slot: formData.time_slot,
          }),
        });

        if (response.ok) {
          loadEvents();
          setShowForm(false);
          setFormData({
            ...formData,
            event_name: "",
            event_date: new Date().toISOString().split('T')[0],
            time_slot: "",
          });
          alert("Event created successfully! All students will receive notifications.");
        } else {
          const error = await response.json();
          alert(error.detail || "Failed to create event");
        }
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const timeSlots = [
    "08:00-09:30", "09:30-11:00", "11:00-12:30", "12:30-14:00",
    "14:00-15:30", "15:30-17:00", "17:00-18:30", "18:30-20:00"
  ];

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const [calendarDate, setCalendarDate] = useState(new Date());

  const handleCalendarDateClick = (day) => {
    if (day) {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const selectedDate = new Date(year, month, day);
      setFormData({ ...formData, session_date: selectedDate.toISOString().split('T')[0] });
      setShowForm(true);
    }
  };

  const prevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <Header
        title="Calendar Management"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="admin-attendance"
      />
      <div style={{ padding: "2rem", width: "100%", margin: 0, background: "linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%)" }}>
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
              Calendar Management
            </h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>
              Manage attendance sessions and event announcements
            </p>
          </div>
          <button
            className="submit-btn"
            onClick={() => setShowForm(!showForm)}
            style={{ background: showForm ? "#ef4444" : "#3b82f6" }}
          >
            {showForm ? "Cancel" : `+ Create ${mode === "attendance" ? "Attendance Session" : "Event"}`}
          </button>
        </div>

        {/* Mode Toggle */}
        <div style={{ 
          marginBottom: "2rem", 
          display: "flex", 
          gap: "0.5rem", 
          background: "#ffffff",
          padding: "0.5rem",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          width: "fit-content"
        }}>
          <button
            onClick={() => {
              setMode("attendance");
              setShowForm(false);
              setSelectedSession(null);
              setSelectedEvent(null);
            }}
            style={{
              padding: "0.875rem 2rem",
              border: "none",
              background: mode === "attendance" ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent",
              color: mode === "attendance" ? "#ffffff" : "#64748b",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: mode === "attendance" ? "700" : "500",
              fontSize: "1rem",
              transition: "all 0.3s ease",
              boxShadow: mode === "attendance" ? "0 4px 12px rgba(102, 126, 234, 0.3)" : "none"
            }}
            onMouseEnter={(e) => {
              if (mode !== "attendance") {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.color = "#475569";
              }
            }}
            onMouseLeave={(e) => {
              if (mode !== "attendance") {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#64748b";
              }
            }}
          >
            Attendance
          </button>
          <button
            onClick={() => {
              setMode("event");
              setShowForm(false);
              setSelectedSession(null);
              setSelectedEvent(null);
            }}
            style={{
              padding: "0.875rem 2rem",
              border: "none",
              background: mode === "event" ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent",
              color: mode === "event" ? "#ffffff" : "#64748b",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: mode === "event" ? "700" : "500",
              fontSize: "1rem",
              transition: "all 0.3s ease",
              boxShadow: mode === "event" ? "0 4px 12px rgba(102, 126, 234, 0.3)" : "none"
            }}
            onMouseEnter={(e) => {
              if (mode !== "event") {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.color = "#475569";
              }
            }}
            onMouseLeave={(e) => {
              if (mode !== "event") {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#64748b";
              }
            }}
          >
            Event Announce
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 1fr" : "1fr", gap: "2rem", marginBottom: "2rem" }}>
          {/* Calendar */}
          <div className="card" style={{ 
            padding: "2rem", 
            background: "linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid rgba(102, 126, 234, 0.1)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ 
                fontSize: "1.75rem", 
                fontWeight: "700", 
                margin: 0,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>Calendar</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={prevMonth}
                  style={{
                    padding: "0.75rem",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#667eea",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.background = "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)";
                    e.currentTarget.style.color = "#667eea";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  ←
                </button>
                <button
                  onClick={nextMonth}
                  style={{
                    padding: "0.75rem",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#667eea",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.background = "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)";
                    e.currentTarget.style.color = "#667eea";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  →
                </button>
              </div>
            </div>
            <div style={{ 
              marginBottom: "1.5rem", 
              fontSize: "1.5rem", 
              fontWeight: "700", 
              color: "#1f2937",
              textAlign: "center",
              padding: "0.75rem",
              background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
              borderRadius: "12px",
              border: "1px solid rgba(102, 126, 234, 0.1)"
            }}>
              {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.75rem" }}>
              {dayNames.map((day) => (
                <div key={day} style={{ 
                  textAlign: "center", 
                  fontWeight: "700", 
                  color: "#667eea", 
                  padding: "0.75rem", 
                  fontSize: "0.9rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  {day}
                </div>
              ))}
              {getDaysInMonth(calendarDate).map((day, index) => (
                <div
                  key={index}
                  onClick={() => handleCalendarDateClick(day)}
                  style={{
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    cursor: day ? "pointer" : "default",
                    background: day ? ((mode === "attendance" ? formData.session_date : formData.event_date) === `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)") : "transparent",
                    color: day ? ((mode === "attendance" ? formData.session_date : formData.event_date) === `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? "#ffffff" : "#1f2937") : "transparent",
                    fontWeight: day ? "600" : "normal",
                    transition: "all 0.3s ease",
                    border: day ? "2px solid #e2e8f0" : "none",
                    boxShadow: day && (mode === "attendance" ? formData.session_date : formData.event_date) === `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? "0 4px 12px rgba(102, 126, 234, 0.3)" : "0 2px 4px rgba(0, 0, 0, 0.05)",
                  }}
                  onMouseEnter={(e) => {
                    const selectedDate = mode === "attendance" ? formData.session_date : formData.event_date;
                    if (day && selectedDate !== `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`) {
                      e.currentTarget.style.background = "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)";
                      e.currentTarget.style.borderColor = "#667eea";
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(102, 126, 234, 0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const selectedDate = mode === "attendance" ? formData.session_date : formData.event_date;
                    if (day && selectedDate !== `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`) {
                      e.currentTarget.style.background = "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)";
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                    }
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="card" style={{ 
              padding: "2rem",
              background: "linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid rgba(102, 126, 234, 0.1)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)"
            }}>
              <h2 style={{ 
                marginBottom: "1.5rem", 
                fontSize: "1.75rem", 
                fontWeight: "700",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>
                {mode === "attendance" ? "Create Attendance Session" : "Create Event Announcement"}
              </h2>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {mode === "attendance" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151" }}>
                    Course
                  </label>
                  <select
                    value={formData.course_id}
                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "2px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                  >
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                ) : (
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151" }}>
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={formData.event_name}
                      onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                      required
                      placeholder="Enter event name"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "2px solid #e5e7eb",
                        borderRadius: "0.5rem",
                        fontSize: "1rem",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151" }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={mode === "attendance" ? formData.session_date : formData.event_date}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      [mode === "attendance" ? "session_date" : "event_date"]: e.target.value 
                    })}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "2px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151" }}>
                    Time Slot
                  </label>
                  <select
                    value={formData.time_slot}
                    onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "2px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                  >
                    <option value="">Select a time slot</option>
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="submit-btn" style={{ width: "100%" }}>
                  {mode === "attendance" ? "Create Session" : "Create Event"}
                </button>
              </form>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          <div className="card" style={{ padding: "1.5rem" }}>
            <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem", fontWeight: "600" }}>
              {mode === "attendance" ? "Attendance Sessions" : "Events"}
            </h2>
            {mode === "attendance" ? (
              loading.sessions ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                No attendance sessions created yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadAttendanceRecords(session.id, false)}
                    style={{
                      padding: "1rem",
                      borderRadius: "0.5rem",
                      border: selectedSession === session.id ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                      background: selectedSession === session.id ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSession !== session.id) {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.background = "#f0f9ff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSession !== session.id) {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.background = "#ffffff";
                      }
                    }}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem", color: "#1f2937" }}>
                      {session.course_code} - {session.course_title}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                      {new Date(session.session_date).toLocaleDateString()} at {session.time_slot}
                    </div>
                  </div>
                ))}
              </div>
              )
            ) : (
              loading.events ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>Loading events...</div>
              ) : events.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                  No events created yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {events.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => loadEventAttendanceRecords(event.id, false)}
                      style={{
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        border: selectedEvent === event.id ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                        background: selectedEvent === event.id ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedEvent !== event.id) {
                          e.currentTarget.style.borderColor = "#3b82f6";
                          e.currentTarget.style.background = "#f0f9ff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedEvent !== event.id) {
                          e.currentTarget.style.borderColor = "#e5e7eb";
                          e.currentTarget.style.background = "#ffffff";
                        }
                      }}
                    >
                      <div style={{ fontWeight: "600", marginBottom: "0.25rem", color: "#1f2937" }}>
                        {event.event_name}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                        {new Date(event.event_date).toLocaleDateString()} at {event.time_slot}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "600", margin: 0 }}>
                {mode === "attendance" ? "Attendance Records" : "Event Attendance"}
              </h2>
              {mode === "attendance" && selectedSession && (
                <button
                  onClick={() => loadAttendanceRecords(selectedSession, false)}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#2563eb";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#3b82f6";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Refresh
                </button>
              )}
              {mode === "event" && selectedEvent && (
                <button
                  onClick={() => loadEventAttendanceRecords(selectedEvent, false)}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#2563eb";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#3b82f6";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Refresh
                </button>
              )}
            </div>
            {mode === "attendance" ? (
              !selectedSession ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                Select a session to view attendance records
              </div>
            ) : loading.records ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>Loading records...</div>
            ) : attendanceRecords.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                No students have checked in yet.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f0f9ff", borderRadius: "0.5rem", border: "1px solid #bae6fd" }}>
                  <div style={{ fontSize: "0.875rem", color: "#0369a1", fontWeight: "500" }}>
                    Total Check-ins: <strong>{attendanceRecords.length}</strong>
                  </div>
                </div>
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Checked In At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.student_student_id}</td>
                        <td>{record.student_name}</td>
                        <td>{new Date(record.checked_in_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
              )
            ) : (
              !selectedEvent ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                  Select an event to view attendance
                </div>
              ) : loading.records ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>Loading records...</div>
              ) : eventAttendanceRecords.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                  No students have attended yet.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f0f9ff", borderRadius: "0.5rem", border: "1px solid #bae6fd" }}>
                    <div style={{ fontSize: "0.875rem", color: "#0369a1", fontWeight: "500" }}>
                      Total Attendees: <strong>{eventAttendanceRecords.length}</strong>
                    </div>
                  </div>
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Attended At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventAttendanceRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{record.student_student_id}</td>
                          <td>{record.student_name}</td>
                          <td>{new Date(record.attended_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin Courses Page
function AdminCoursesPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({ code: "", title: "", credits: "" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authToken && currentUser?.role === "admin") {
      loadCourses();
    } else {
      onNavigate("booking");
    }
  }, [authToken, currentUser, onNavigate]);

  const loadCourses = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/courses`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load courses:", err);
        setLoading(false);
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingCourse
      ? `${API_BASE_URL}/courses/${editingCourse.id}`
      : `${API_BASE_URL}/courses`;
    const method = editingCourse ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          code: formData.code,
          title: formData.title,
          credits: parseInt(formData.credits),
        }),
      });

      if (response.ok) {
        loadCourses();
        setShowForm(false);
        setEditingCourse(null);
        setFormData({ code: "", title: "", credits: "" });
      } else {
        const error = await response.json();
        alert(error.detail || "Failed to save course");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({ code: course.code, title: course.title, credits: course.credits.toString() });
    setShowForm(true);
  };

  const handleDelete = async (courseId) => {
    if (!confirm("Are you sure you want to delete this course?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        loadCourses();
      } else {
        alert("Failed to delete course");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const filteredCourses = searchQuery
    ? courses.filter(
        (c) =>
          c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : courses;

  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-screen">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header
        title="Course Management"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="admin-courses"
      />
      <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header Section */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2rem", fontWeight: "700", color: "#1f2937" }}>
              Course Management
            </h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>
              Create, edit, and manage course catalog
            </p>
          </div>
          <button
            onClick={() => onNavigate("admin-dashboard")}
            style={{
              padding: "0.625rem 1.25rem",
              background: "#f3f4f6",
              color: "#374151",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#e5e7eb")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#f3f4f6")}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
              border: "1px solid #3b82f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>📚</div>
              <div style={{ fontSize: "0.875rem", color: "#1e40af", fontWeight: "600" }}>TOTAL COURSES</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1e3a8a" }}>{courses.length}</div>
            <div style={{ fontSize: "0.75rem", color: "#1e40af", marginTop: "0.25rem" }}>Available Courses</div>
          </div>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
              border: "1px solid #10b981",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>🎓</div>
              <div style={{ fontSize: "0.875rem", color: "#065f46", fontWeight: "600" }}>TOTAL CREDITS</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#064e3b" }}>{totalCredits}</div>
            <div style={{ fontSize: "0.75rem", color: "#065f46", marginTop: "0.25rem" }}>Sum of All Credits</div>
          </div>
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              border: "1px solid #f59e0b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem" }}>📊</div>
              <div style={{ fontSize: "0.875rem", color: "#92400e", fontWeight: "600" }}>AVG CREDITS</div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: "700", color: "#78350f" }}>
              {courses.length > 0 ? (totalCredits / courses.length).toFixed(1) : "0"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.25rem" }}>Per Course Average</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingCourse(null);
                setFormData({ code: "", title: "", credits: "" });
              }}
              style={{
                padding: "0.75rem 1.5rem",
                background: showForm ? "#6b7280" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.875rem",
                transition: "all 0.2s",
                boxShadow: showForm ? "none" : "0 4px 6px rgba(59, 130, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onMouseEnter={(e) => {
                if (!showForm) {
                  e.currentTarget.style.background = "#2563eb";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!showForm) {
                  e.currentTarget.style.background = "#3b82f6";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {showForm ? "✗ Cancel" : "+ Add New Course"}
            </button>
            <div style={{ position: "relative", flex: "1", minWidth: "250px", maxWidth: "400px" }}>
              <input
                type="text"
                placeholder="Search courses by code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem 2.5rem 0.625rem 1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
              />
              <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                🔍
              </span>
            </div>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div
            className="card"
            style={{
              marginBottom: "1.5rem",
              padding: "2rem",
              background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
              border: "2px solid #3b82f6",
            }}
          >
            <h3 style={{ margin: "0 0 1.5rem 0", color: "#1e40af", fontSize: "1.5rem", fontWeight: "700" }}>
              {editingCourse ? "✏️ Edit Course" : "➕ Add New Course"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151", fontSize: "0.875rem" }}>
                    Course Code <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., CS101"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151", fontSize: "0.875rem" }}>
                    Credits <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                    placeholder="e.g., 3"
                    min="1"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
                    required
                  />
                </div>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#374151", fontSize: "0.875rem" }}>
                  Course Title <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Introduction to Computer Science"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="submit"
                  style={{
                    padding: "0.75rem 2rem",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#059669";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#10b981";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {editingCourse ? "✓ Update Course" : "✓ Add Course"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCourse(null);
                    setFormData({ code: "", title: "", credits: "" });
                  }}
                  style={{
                    padding: "0.75rem 2rem",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Courses Table */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          {filteredCourses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📚</div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#374151", fontSize: "1.25rem" }}>
                {searchQuery ? "No courses found" : "No courses yet"}
              </h3>
              <p style={{ margin: "0 0 1.5rem 0", color: "#6b7280" }}>
                {searchQuery ? "Try adjusting your search query" : "Add your first course to get started!"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    setShowForm(true);
                    setEditingCourse(null);
                    setFormData({ code: "", title: "", credits: "" });
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                  }}
                >
                  + Add First Course
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Course Code
                    </th>
                    <th style={{ padding: "1rem", textAlign: "left", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Course Title
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Credits
                    </th>
                    <th style={{ padding: "1rem", textAlign: "center", fontWeight: "600", color: "#374151", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr
                      key={course.id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                    >
                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: "700", color: "#3b82f6", fontSize: "1rem" }}>{course.code}</div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ color: "#1f2937", fontWeight: "500" }}>{course.title}</div>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.375rem 1rem",
                            background: "#dbeafe",
                            color: "#1e40af",
                            borderRadius: "9999px",
                            fontWeight: "700",
                            fontSize: "0.875rem",
                          }}
                        >
                          {course.credits} {course.credits === 1 ? "Credit" : "Credits"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                          <button
                            onClick={() => handleEdit(course)}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "0.875rem",
                              transition: "all 0.2s",
                              boxShadow: "0 2px 4px rgba(59, 130, 246, 0.2)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#2563eb";
                              e.currentTarget.style.transform = "translateY(-1px)";
                              e.currentTarget.style.boxShadow = "0 4px 6px rgba(59, 130, 246, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#3b82f6";
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 2px 4px rgba(59, 130, 246, 0.2)";
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(course.id)}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "0.875rem",
                              transition: "all 0.2s",
                              boxShadow: "0 2px 4px rgba(239, 68, 68, 0.2)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#dc2626";
                              e.currentTarget.style.transform = "translateY(-1px)";
                              e.currentTarget.style.boxShadow = "0 4px 6px rgba(239, 68, 68, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#ef4444";
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 2px 4px rgba(239, 68, 68, 0.2)";
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Profile Page with Tabs
function ProfilePage({ currentUser, authToken, onLogout, onNavigate }) {
  const [profile, setProfile] = useState(currentUser);
  const [activeTab, setActiveTab] = useState("about");
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    year: currentUser?.year || 1,
  });
  const [message, setMessage] = useState("");
  const [courses, setCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [courseGrades, setCourseGrades] = useState({});
  const [loading, setLoading] = useState({ courses: false, grades: false, courseGrades: {} });

  const isAdmin = profile?.role === "admin";

  // Fetch courses and grades when switching to those tabs
  useEffect(() => {
    if (activeTab === "courses" && courses.length === 0 && !loading.courses) {
      fetchCourses();
    }
    if (activeTab === "grades") {
      if (isAdmin && allCourses.length === 0 && !loading.grades) {
        fetchAllCourses();
      } else if (!isAdmin && grades.length === 0 && !loading.grades) {
        fetchGrades();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchCourses = async () => {
    setLoading(prev => ({ ...prev, courses: true }));
    try {
      if (isAdmin) {
        // For admin: fetch all courses
        const response = await fetch(`${API_BASE_URL}/courses`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCourses(data);
        }
      } else {
        // For students: fetch registered courses
        const response = await fetch(`${API_BASE_URL}/course-registrations`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCourses(data.filter(reg => reg.status === "approved"));
        }
      }
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setLoading(prev => ({ ...prev, courses: false }));
    }
  };

  const fetchAllCourses = async () => {
    setLoading(prev => ({ ...prev, grades: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/courses`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllCourses(data);
      }
    } catch (error) {
      console.error("Failed to load courses:", error);
    } finally {
      setLoading(prev => ({ ...prev, grades: false }));
    }
  };

  const fetchCourseGrades = async (courseId) => {
    if (courseGrades[courseId]) {
      // Already loaded, just toggle selection
      setSelectedCourseId(selectedCourseId === courseId ? null : courseId);
      return;
    }

    setLoading(prev => ({ ...prev, courseGrades: { ...prev.courseGrades, [courseId]: true } }));
    try {
      // For admin, fetch all registered students for this course with their grades
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}/students`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCourseGrades(prev => ({ ...prev, [courseId]: data }));
        setSelectedCourseId(courseId);
      }
    } catch (error) {
      console.error("Failed to load course students:", error);
    } finally {
      setLoading(prev => ({ ...prev, courseGrades: { ...prev.courseGrades, [courseId]: false } }));
    }
  };

  const fetchGrades = async () => {
    setLoading(prev => ({ ...prev, grades: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/grades`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGrades(data);
      }
    } catch (error) {
      console.error("Failed to load grades:", error);
    } finally {
      setLoading(prev => ({ ...prev, grades: false }));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setEditing(false);
        setMessage("Profile updated successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await response.json();
        setMessage(error.detail || "Failed to update profile");
      }
    } catch (error) {
      setMessage("Error: " + error.message);
    }
  };

  return (
    <div className="page-container">
      <Header
        title="My Profile"
        currentUser={profile}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="profile"
      />
      <div className="profile-page-container">
        {/* Tab Navigation */}
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            About
          </button>
          <button
            className={`profile-tab ${activeTab === "courses" ? "active" : ""}`}
            onClick={() => setActiveTab("courses")}
          >
            Courses
          </button>
          <button
            className={`profile-tab ${activeTab === "grades" ? "active" : ""}`}
            onClick={() => setActiveTab("grades")}
          >
            Grades
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-tab-content">
          {activeTab === "about" && (
            <div className="profile-tab-card">
              {message && (
                <div
                  className={`profile-message ${message.includes("successfully") ? "success" : "error"}`}
                >
                  {message}
                </div>
              )}
              
              <div className="tab-header-section">
                <h2>Profile Information</h2>
              </div>
              
              <div className="profile-header-section">
                <div className="profile-avatar-large">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div className="profile-header-info">
                  <h2 className="profile-name">{profile?.name}</h2>
                  <p className="profile-role">{profile?.role === "admin" ? "Administrator" : `Year ${profile?.year} Student`}</p>
                </div>
                {!editing && (
                  <button className="profile-edit-btn" onClick={() => setEditing(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>

              {!editing ? (
                <div className="profile-info-grid">
                  <div className="profile-info-card">
                    <div className="profile-info-label">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      </svg>
                      Student ID
                    </div>
                    <div className="profile-info-value">{profile?.student_id}</div>
                  </div>
                  <div className="profile-info-card">
                    <div className="profile-info-label">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      Full Name
                    </div>
                    <div className="profile-info-value">{profile?.name}</div>
                  </div>
                  <div className="profile-info-card">
                    <div className="profile-info-label">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      Email Address
                    </div>
                    <div className="profile-info-value">{profile?.email || "Not provided"}</div>
                  </div>
                  <div className="profile-info-card">
                    <div className="profile-info-label">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Academic Year
                    </div>
                    <div className="profile-info-value">Year {profile?.year}</div>
                  </div>
                  <div className="profile-info-card">
                    <div className="profile-info-label">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                      Account Role
                    </div>
                    <div className="profile-info-value">
                      <span className="role-badge">{profile?.role === "admin" ? "Administrator" : "Student"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="profile-edit-form">
                  <h3 className="profile-section-title">Edit Profile Information</h3>
                  <form onSubmit={handleUpdate} className="profile-form">
                    <div className="form-group">
                      <label htmlFor="profile-name">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Full Name
                      </label>
                      <input
                        id="profile-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="profile-email">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        Email Address
                      </label>
                      <input
                        id="profile-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Enter your email address"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="profile-year">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Academic Year
                      </label>
                      <select
                        id="profile-year"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                        required
                      >
                        <option value="1">Year 1</option>
                        <option value="2">Year 2</option>
                        <option value="3">Year 3</option>
                        <option value="4">Year 4</option>
                      </select>
                    </div>
                    <div className="profile-form-actions">
                      <button type="submit" className="profile-save-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                          <polyline points="17 21 17 13 7 13 7 21"></polyline>
                          <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className="profile-cancel-btn"
                        onClick={() => {
                          setEditing(false);
                          setFormData({
                            name: profile?.name || "",
                            email: profile?.email || "",
                            year: profile?.year || 1,
                          });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === "courses" && (
            <div className="profile-tab-card">
              <div className="tab-header-section">
                <h2>{isAdmin ? "All Courses" : "My Courses"}</h2>
                {courses.length > 0 && (
                  <div className="tab-stats">
                    <div className="stat-item">
                      <span className="stat-value">{courses.length}</span>
                      <span className="stat-label">Total</span>
                    </div>
                    {!isAdmin && (
                      <div className="stat-item">
                        <span className="stat-value">
                          {courses.reduce((sum, c) => sum + (c.course_credits || 0), 0)}
                        </span>
                        <span className="stat-label">Credits</span>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="stat-item">
                        <span className="stat-value">
                          {courses.reduce((sum, c) => sum + (c.credits || 0), 0)}
                        </span>
                        <span className="stat-label">Total Credits</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {loading.courses ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p className="loading-text">Loading courses...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                  </div>
                  <p>{isAdmin ? "No courses found." : "No approved courses found."}</p>
                  {!isAdmin && (
                    <p>Visit the <a href="#" onClick={(e) => { e.preventDefault(); onNavigate("credit"); }}>Credit</a> page to register for courses.</p>
                  )}
                </div>
              ) : (
                <div className="courses-list">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Title</th>
                        <th>Credits</th>
                        {!isAdmin && (
                          <>
                            <th>Semester</th>
                            <th>Year</th>
                            <th>Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course, index) => (
                        <tr key={course.id} style={{ animationDelay: `${index * 0.05}s` }}>
                          <td>
                            <span className="course-code-badge">{isAdmin ? course.code : course.course_code}</span>
                          </td>
                          <td>
                            <span className="course-title">{isAdmin ? course.title : course.course_title}</span>
                          </td>
                          <td>
                            <span className="credits-display">{isAdmin ? course.credits : course.course_credits}</span>
                          </td>
                          {!isAdmin && (
                            <>
                              <td>{course.semester}</td>
                              <td>{course.year}</td>
                              <td>
                                <span className={`status-badge ${course.status}`}>
                                  {course.status}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "grades" && (
            <div className="profile-tab-card">
              <div className="tab-header-section">
                <h2>{isAdmin ? "Student Grades by Course" : "My Grades"}</h2>
                {!isAdmin && grades.length > 0 && (
                  <div className="tab-stats">
                    <div className="stat-item">
                      <span className="stat-value">{grades.length}</span>
                      <span className="stat-label">Courses</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">
                        {grades.reduce((sum, g) => sum + (g.course_credits || 0), 0)}
                      </span>
                      <span className="stat-label">Credits</span>
                    </div>
                  </div>
                )}
              </div>
              {isAdmin ? (
                <>
                  {loading.grades ? (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p className="loading-text">Loading courses...</p>
                    </div>
                  ) : allCourses.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                      </div>
                      <p>No courses found.</p>
                    </div>
                  ) : (
                    <div className="admin-grades-container">
                      <div className="courses-list-grades">
                        <h3>Select a Course to View Student Grades</h3>
                        <div className="course-cards-grid">
                          {allCourses.map((course) => (
                            <div
                              key={course.id}
                              className={`course-card ${selectedCourseId === course.id ? "active" : ""}`}
                              onClick={() => fetchCourseGrades(course.id)}
                            >
                              <div className="course-card-header">
                                <h4>{course.code}</h4>
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className={selectedCourseId === course.id ? "rotated" : ""}
                                >
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                              </div>
                              <p className="course-card-title">{course.title}</p>
                              <p className="course-card-credits">{course.credits} Credits</p>
                              {loading.courseGrades[course.id] && (
                                <div className="course-loading">Loading...</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedCourseId && courseGrades[selectedCourseId] && (
                        <div className="course-grades-detail">
                          <div className="grades-header">
                            <h3>
                              Registered Students - {allCourses.find(c => c.id === selectedCourseId)?.code}
                            </h3>
                            {courseGrades[selectedCourseId].length > 0 && (
                              <div className="grades-summary">
                                <div className="summary-item">
                                  <span className="summary-label">Total Students:</span>
                                  <span className="summary-value">{courseGrades[selectedCourseId].length}</span>
                                </div>
                                <div className="summary-item">
                                  <span className="summary-label">With Grades:</span>
                                  <span className="summary-value">
                                    {courseGrades[selectedCourseId].filter(s => s.grade).length}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          {courseGrades[selectedCourseId].length === 0 ? (
                            <div className="empty-state">
                              <p>No students registered for this course.</p>
                            </div>
                          ) : (
                            <div className="grades-table-wrapper">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Student ID</th>
                                      <th>Student Name</th>
                                      <th>Grade</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {courseGrades[selectedCourseId].map((student, index) => (
                                      <tr key={`${student.student_id}-${index}`} style={{ animationDelay: `${index * 0.03}s` }}>
                                        <td>
                                          <span className="student-id-display">{student.student_id}</span>
                                        </td>
                                        <td>
                                          <span className="student-name-display">{student.student_name}</span>
                                        </td>
                                        <td>
                                          {student.grade ? (
                                            <span className={`grade-badge grade-${student.grade.toUpperCase().replace('+', '\\+')}`}>
                                              {student.grade}
                                            </span>
                                          ) : (
                                            <span className="no-grade-badge">No grade</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loading.grades ? (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p className="loading-text">Loading grades...</p>
                    </div>
                  ) : grades.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                      </div>
                      <p>No grades available yet.</p>
                      <p>Grades will appear here once they are released by your instructors.</p>
                    </div>
                  ) : (
                    <div className="grades-list">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Course Code</th>
                              <th>Course Title</th>
                              <th>Credits</th>
                              <th>Grade</th>
                              <th>Semester</th>
                              <th>Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grades.map((grade, index) => (
                              <tr key={grade.id} style={{ animationDelay: `${index * 0.05}s` }}>
                                <td>
                                  <span className="course-code-badge">{grade.course_code}</span>
                                </td>
                                <td>
                                  <span className="course-title">{grade.course_title}</span>
                                </td>
                                <td>
                                  <span className="credits-display">{grade.course_credits}</span>
                                </td>
                                <td>
                                  <span className={`grade-badge grade-${grade.grade.toUpperCase().replace('+', '\\+')}`}>
                                    {grade.grade}
                                  </span>
                                </td>
                                <td>{grade.semester}</td>
                                <td>{grade.year}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Notifications Page
function NotificationsPage({ currentUser, authToken, onLogout, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authToken) {
      fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setNotifications(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load notifications:", err);
          setLoading(false);
        });
    }
  }, [authToken]);

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="page-container">
      <Header
        title="Notifications"
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="notifications"
      />
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <div className="card">
          <h2>Notifications</h2>
          {notifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
              No notifications
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: "1rem",
                    borderRadius: "4px",
                    background: notif.is_read ? "#f9fafb" : "#eff6ff",
                    border: "1px solid #e5e7eb",
                    cursor: notif.is_read ? "default" : "pointer",
                  }}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                        {notif.title}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                        {notif.message}
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                        {new Date(notif.created_at).toLocaleString()}
                      </div>
                      {notif.type === "attendance" && !notif.is_read && (
                        <button
                          className="submit-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const sessionsRes = await fetch(`${API_BASE_URL}/attendance/sessions`, {
                                headers: { Authorization: `Bearer ${authToken}` },
                              });
                              if (sessionsRes.ok) {
                                const sessions = await sessionsRes.json();
                                const courseCode = notif.title.split(" - ")[1]?.split(" ")[0];
                                const session = sessions.find(s => s.course_code === courseCode);
                                if (session) {
                                  const checkInRes = await fetch(`${API_BASE_URL}/attendance/check-in/${session.id}`, {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${authToken}` },
                                  });
                                  if (checkInRes.ok) {
                                    markAsRead(notif.id);
                                    alert("Attendance checked in successfully!");
                                    loadNotifications();
                                  } else {
                                    const error = await checkInRes.json();
                                    alert(error.detail || "Failed to check in");
                                  }
                                } else {
                                  alert("Session not found");
                                }
                              }
                            } catch (error) {
                              alert("Error: " + error.message);
                            }
                          }}
                          style={{
                            marginTop: "0.75rem",
                            padding: "0.5rem 1.25rem",
                            fontSize: "0.875rem",
                            background: "#10b981",
                          }}
                        >
                          Check
                        </button>
                      )}
                      {notif.type === "event" && !notif.is_read && (
                        <button
                          className="submit-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const eventsRes = await fetch(`${API_BASE_URL}/events`, {
                                headers: { Authorization: `Bearer ${authToken}` },
                              });
                              if (eventsRes.ok) {
                                const events = await eventsRes.json();
                                const eventName = notif.title.split(" - ")[1];
                                const event = events.find(e => e.event_name === eventName);
                                if (event) {
                                  const attendRes = await fetch(`${API_BASE_URL}/events/${event.id}/attend`, {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${authToken}` },
                                  });
                                  if (attendRes.ok) {
                                    markAsRead(notif.id);
                                    alert("Event attendance recorded successfully!");
                                    loadNotifications();
                                  } else {
                                    const error = await attendRes.json();
                                    alert(error.detail || "Failed to attend event");
                                  }
                                } else {
                                  alert("Event not found");
                                }
                              }
                            } catch (error) {
                              alert("Error: " + error.message);
                            }
                          }}
                          style={{
                            marginTop: "0.75rem",
                            padding: "0.5rem 1.25rem",
                            fontSize: "0.875rem",
                            background: "#3b82f6",
                          }}
                        >
                          Attend
                        </button>
                      )}
                    </div>
                    {!notif.is_read && (
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#3b82f6",
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Footer Component
function Footer() {
  return (
    <div className="footer-wrapper">
      <footer>
        <div className="footer-content">
          <div className="footer-section footer-brand">
            <div className="footer-logo">
              <span className="logo-icon">🎓</span>
              <span className="logo-text">SE Student Portal</span>
            </div>
            <p className="footer-tagline">Empowering students with seamless booking and academic tools</p>
            <div className="footer-copyright">© 2025 Team Axis. All rights reserved.</div>
          </div>

          <div className="footer-section footer-social">
            <h4 className="footer-heading">Connect With Us</h4>
            <div className="social-links">
              <a
                href="#"
                className="social-link instagram"
                aria-label="Instagram"
                onClick={(e) => { e.preventDefault(); }}
              >
                <span className="social-icon">📷</span>
                <span className="social-text">Instagram</span>
              </a>
              <a
                href="#"
                className="social-link facebook"
                aria-label="Facebook"
                onClick={(e) => { e.preventDefault(); }}
              >
                <span className="social-icon">👥</span>
                <span className="social-text">Facebook</span>
              </a>
              <a
                href="#"
                className="social-link line"
                aria-label="Line"
                onClick={(e) => { e.preventDefault(); }}
              >
                <span className="social-icon">💬</span>
                <span className="social-text">Line</span>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-divider"></div>
          <p className="footer-bottom-text">
            Team Axis
          </p>
        </div>
      </footer>
    </div>
  );
}
