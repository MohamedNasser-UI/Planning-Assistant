import type React from "react";

const menuItems = [
  "Overview",
  "Daily Prediction",
  "Generate Predictions",
  "Harvest Planning",
  "Capacity Planning"
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">LOGO</div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = item === "Capacity Planning";
          return (
            <button
              key={item}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              type="button"
            >
              <span className="sidebar-nav-icon" />
              <span>{item}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

