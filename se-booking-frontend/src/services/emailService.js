import { EMAIL_CONFIG } from "../config/constants";
import { formatDate } from "../utils/dateUtils";

// Load EmailJS
export const loadEmailJS = () => {
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

// Email sending function
export const sendBookingEmail = async (booking, type = "NEW BOOKING") => {
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
export const sendContactEmail = async (form) => {
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

