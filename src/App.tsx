import type React from "react";
import { Sidebar } from "./layout/Sidebar";
import { StepperHeader } from "./layout/StepperHeader";
import { BroilerScenarioPage } from "./modules/broiler/BroilerScenarioPage";

export const App: React.FC = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <StepperHeader />
        <BroilerScenarioPage />
      </div>
    </div>
  );
};

