import type React from "react";

interface Step {
  label: string;
  subtitle: string;
}

const steps: Step[] = [
  { label: "Broiler", subtitle: "Configure" },
  { label: "Select Scenario", subtitle: "Compare" },
  { label: "Assumptions / Market", subtitle: "Configure" },
  { label: "Save Plan", subtitle: "Save or discard" }
];

export const StepperHeader: React.FC = () => {
  const activeIndex = 0;

  return (
    <header className="stepper-header">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        return (
          <div
            key={step.label}
            className={`stepper-step ${isActive ? "active" : "disabled"}`}
          >
            <div className="stepper-circle">{index + 1}</div>
            <div className="stepper-text">
              <div className="stepper-label">{step.label}</div>
              <div className="stepper-subtitle">{step.subtitle}</div>
            </div>
          </div>
        );
      })}
    </header>
  );
};

