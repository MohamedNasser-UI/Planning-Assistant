import type React from "react";

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  checked,
  onChange,
  description
}) => {
  return (
    <label className="toggle">
      <div className="toggle-main">
        <button
          type="button"
          className={`toggle-track ${checked ? "checked" : ""}`}
          onClick={() => onChange(!checked)}
        >
          <span className="toggle-thumb" />
        </button>
        <div className="toggle-text">
          <span className="toggle-label">{label}</span>
          {description && (
            <span className="toggle-description">{description}</span>
          )}
        </div>
      </div>
    </label>
  );
};

