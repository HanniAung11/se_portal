import React, { useState } from "react";

export default function Header({ title, currentUser, onLogout, onNavigate, activePage }) {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((o) => !o);

  return (
    <header className="main-header">
      <h1 className="welcome">{title}</h1>
      {currentUser && (
        <nav>
          <a
            href="#"
            className={activePage === "booking" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("booking");
            }}
          >
            Booking
          </a>
          <a
            href="#"
            className={`chat-icon ${activePage === "chat" ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("chat");
            }}
          >
            ChatRoom
          </a>
          <a
            href="#"
            className={activePage === "curriculum" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("curriculum");
            }}
          >
            Curriculum
          </a>
          <a
            href="#"
            className={activePage === "credit" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("credit");
            }}
          >
            Credit
          </a>
          <a
            href="#"
            className={activePage === "gpa" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("gpa");
            }}
          >
            GPA
          </a>
          <a
            href="#"
            className={activePage === "contact" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              onNavigate("contact");
            }}
          >
            Contact
          </a>

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
                {currentUser.name} (Year {currentUser.year})
              </button>
              {open && (
                <div className="profile-dropdown">
                  <button
                    className="logout-nav-btn"
                    style={{ color: "black" }}
                    onClick={() => {
                      setOpen(false);
                      onNavigate("profile");
                    }}
                  >
                    Profile
                  </button>
                  <button
                    className="logout-nav-btn"
                    style={{ color: "black" }}
                    onClick={() => {
                      setOpen(false);
                      onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

