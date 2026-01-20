import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/Card";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import {
  computeBroilerResults,
  formatNumber,
  buildFarmScenarios
} from "./calculations";
import type {
  BroilerScenario,
  BroilerInputs,
  BroilerConfig,
  UnitsModeKey
} from "./types";

const STORAGE_KEY = "broiler-scenarios-v1";

const defaultInputs: BroilerInputs = {
  sn1TargetBroilerMeat: null,
  sn2HarvestBirdAvgWeight: null,
  sn4PlannedMortality: null,
  sn6CycleTimeDays: null,
  sn10FarmCapacity: null,
  sn11NumberOfHouses: null,
  sn12HouseArea: null,
  yieldPercent: 72
};

const defaultConfig: BroilerConfig = {
  unitsMode: "tonsPerYear_kgPerBird",
  useYield: false,
  useFullCyclesOnly: false,
  useLeapYearCycles: false,
  mortalityAsPercent: true
};

function createEmptyScenario(): BroilerScenario {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    timeHorizon: "year",
    createdAt: new Date().toISOString(),
    inputs: { ...defaultInputs },
    config: { ...defaultConfig }
  };
}

function loadLatestScenario(): BroilerScenario {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyScenario();
    const parsed: BroilerScenario[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createEmptyScenario();
    }
    return parsed[parsed.length - 1];
  } catch {
    return createEmptyScenario();
  }
}

function persistScenario(scenario: BroilerScenario) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: BroilerScenario[] = raw ? JSON.parse(raw) : [];
    const updated = [...list, scenario];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // fail silently for now, ready for API integration later
  }
}

export const BroilerScenarioPage: React.FC = () => {
  const [scenario, setScenario] = useState<BroilerScenario>(() =>
    typeof window === "undefined" ? createEmptyScenario() : loadLatestScenario()
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeScenarioView, setActiveScenarioView] = useState<
    "base" | "rounded" | "floored" | "combined"
  >("combined");
  const [activeResultsTab, setActiveResultsTab] = useState<
    "fullParameters" | "summary"
  >("fullParameters");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(() =>
    new Date().toLocaleString()
  );

  const results = useMemo(
    () => computeBroilerResults(scenario.inputs, scenario.config),
    [scenario.inputs, scenario.config]
  );

  useEffect(() => {
    setLastUpdatedAt(new Date().toLocaleString());
  }, [scenario.inputs, scenario.config]);

  useEffect(() => {
    if (saveMessage) {
      const timeout = setTimeout(() => setSaveMessage(null), 2500);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [saveMessage]);

  const handleInputChange = (key: keyof BroilerInputs, value: string) => {
    const numeric = value === "" ? null : Number(value);
    setScenario((prev) => ({
      ...prev,
      inputs: { ...prev.inputs, [key]: Number.isNaN(numeric) ? null : numeric }
    }));
  };

  const handleConfigChange = (patch: Partial<BroilerConfig>) => {
    setScenario((prev) => ({
      ...prev,
      config: { ...prev.config, ...patch }
    }));
  };

  const handleScenarioMetaChange = (field: "name" | "description" | "timeHorizon", value: string) => {
    setScenario((prev) => ({
      ...prev,
      [field]: field === "timeHorizon" ? value : value
    }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const i = scenario.inputs;
    const c = scenario.config;

    if (!scenario.name.trim()) {
      errors.scenarioName = "Scenario name is required.";
    }

    if (i.sn4PlannedMortality != null) {
      if (c.mortalityAsPercent) {
        if (i.sn4PlannedMortality < 0 || i.sn4PlannedMortality >= 100) {
          errors.sn4PlannedMortality =
            "Mortality must be between 0 and below 100 when using percent mode.";
        }
      } else if (i.sn4PlannedMortality < 0 || i.sn4PlannedMortality >= 1) {
        errors.sn4PlannedMortality =
          "Mortality must be between 0 and below 1 when using fraction mode.";
      }
    }

    (["sn6CycleTimeDays", "sn10FarmCapacity", "sn11NumberOfHouses", "sn12HouseArea"] as const).forEach(
      (key) => {
        const value = i[key];
        if (value != null && value <= 0) {
          errors[key] = "Value must be greater than zero.";
        }
      }
    );

    if (c.useYield) {
      if (i.yieldPercent == null || i.yieldPercent <= 0 || i.yieldPercent > 100) {
        errors.yieldPercent = "Yield% must be between 0 and 100.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveScenario = () => {
    if (!validate()) {
      setSaveMessage("Please resolve validation issues before saving.");
      return;
    }
    const scenarioToSave = { ...scenario, id: crypto.randomUUID() };
    persistScenario(scenarioToSave);
    setSaveMessage("Scenario saved locally. Ready for API sync later.");
  };

  const unitsModeLabel = (mode: UnitsModeKey): string => {
    switch (mode) {
      case "tonsPerYear_kgPerBird":
        return "SN1 in Tons/year, SN2 in kg/bird";
      case "kgPerYear_kgPerBird":
        return "SN1 in kg/year, SN2 in kg/bird";
      case "meatTonsWithYield":
        return "SN1 is meat/carcass tons (yield %)";
      default:
        return mode;
    }
  };

  const farmsRequiredRounded =
    results.sn14NumberOfFarms != null
      ? Math.ceil(results.sn14NumberOfFarms)
      : null;

  const farmScenarios = useMemo(
    () => buildFarmScenarios(scenario.inputs, scenario.config, results),
    [scenario.inputs, scenario.config, results]
  );

  const baseScenario = farmScenarios[0];
  const roundedScenario = farmScenarios[1];
  const flooredScenario = farmScenarios[2];

  const mortRaw = scenario.inputs.sn4PlannedMortality;
  const mortalityFraction =
    mortRaw == null
      ? null
      : scenario.config.mortalityAsPercent
        ? mortRaw / 100
        : mortRaw;

  const sn7 = results.sn7CyclesPerYear ?? null;

  const buildCalcForScenario = useMemo(() => {
    return (
      scenarioRow:
        | typeof baseScenario
        | typeof roundedScenario
        | typeof flooredScenario
    ) => {
      const sn1 = scenarioRow?.sn1TargetBroilerMeat ?? null;
      const sn3 = scenarioRow?.sn3HarvestBirdsNumber ?? null;
      const sn9 = scenarioRow?.sn9PlacementPerCycle ?? null;
      const farms = scenarioRow?.farms ?? null;

      let sn5: number | null = null;
      let sn8: number | null = null;
      let sn13: number | null = null;
      let sn14Local: number | null = null;

      if (
        sn3 != null &&
        mortalityFraction != null &&
        mortalityFraction >= 0 &&
        mortalityFraction < 1
      ) {
        const denom = 1 - mortalityFraction;
        sn5 = denom === 0 ? null : sn3 / denom;
      }

      if (sn3 != null && sn7 != null && sn7 > 0) {
        sn8 = sn3 / sn7;
      }

      if (
        scenario.inputs.sn10FarmCapacity != null &&
        scenario.inputs.sn11NumberOfHouses != null &&
        scenario.inputs.sn12HouseArea != null
      ) {
        const denom =
          scenario.inputs.sn11NumberOfHouses * scenario.inputs.sn12HouseArea;
        sn13 =
          denom > 0 ? scenario.inputs.sn10FarmCapacity / denom : null;
      }

      if (sn9 != null && scenario.inputs.sn10FarmCapacity != null) {
        const cap = scenario.inputs.sn10FarmCapacity;
        sn14Local = cap > 0 ? sn9 / cap : null;
      } else if (farms != null) {
        sn14Local = farms;
      }

      return {
        sn1,
        sn3,
        sn4: scenario.inputs.sn4PlannedMortality,
        sn6: scenario.inputs.sn6CycleTimeDays,
        sn10: scenario.inputs.sn10FarmCapacity,
        sn11: scenario.inputs.sn11NumberOfHouses,
        sn12: scenario.inputs.sn12HouseArea,
        sn5,
        sn7,
        sn8,
        sn9,
        sn13,
        sn14: sn14Local
      };
    };
  }, [
    scenario.inputs.sn10FarmCapacity,
    scenario.inputs.sn11NumberOfHouses,
    scenario.inputs.sn12HouseArea,
    scenario.inputs.sn4PlannedMortality,
    scenario.inputs.sn6CycleTimeDays,
    mortalityFraction,
    sn7
  ]);

  const baseVals = useMemo(
    () => buildCalcForScenario(baseScenario),
    [buildCalcForScenario, baseScenario]
  );
  const roundedVals = useMemo(
    () => buildCalcForScenario(roundedScenario),
    [buildCalcForScenario, roundedScenario]
  );
  const flooredVals = useMemo(
    () => buildCalcForScenario(flooredScenario),
    [buildCalcForScenario, flooredScenario]
  );

  const uomForSn1 =
    scenario.config.unitsMode === "kgPerYear_kgPerBird" ? "kg/year" : "tons/year";

  const fullParametersRows = useMemo(() => {
    const common = {
      sn2: scenario.inputs.sn2HarvestBirdAvgWeight,
      sn4: scenario.inputs.sn4PlannedMortality,
      sn6: scenario.inputs.sn6CycleTimeDays,
      sn10: scenario.inputs.sn10FarmCapacity,
      sn11: scenario.inputs.sn11NumberOfHouses,
      sn12: scenario.inputs.sn12HouseArea
    };

    const rows = [
      { key: "sn1", label: "Target Broiler Meat", uom: uomForSn1 },
      { key: "sn2", label: "Harvest Birds Average Weight", uom: "kg/bird" },
      {
        key: "sn4",
        label: "Planned Mortality",
        uom: scenario.config.mortalityAsPercent ? "%" : "fraction"
      },
      { key: "sn6", label: "Broiler Cycle Time", uom: "days" },
      { key: "sn10", label: "Broiler Farm Capacity", uom: "birds/cycle" },
      { key: "sn11", label: "Broiler No. of Houses", uom: "houses" },
      { key: "sn12", label: "Broiler House Area", uom: "m²" },
      { key: "sn3", label: "Harvest Birds Number", uom: "birds/year" },
      { key: "sn5", label: "Overall Broiler Placement", uom: "birds" },
      { key: "sn7", label: "Broiler Cycles Per Year", uom: "cycles/year" },
      { key: "sn8", label: "Broiler Harvest Per Cycle", uom: "birds/cycle" },
      { key: "sn9", label: "Broiler Placement Per Cycle", uom: "birds/cycle" },
      { key: "sn13", label: "Broiler Density", uom: "birds/m²" },
      { key: "sn14", label: "Broiler No. of Farms", uom: "farms" }
    ] as const;

    const getValue = (
      which: "base" | "rounded" | "floored",
      key: (typeof rows)[number]["key"]
    ): number | null => {
      if (key in common) {
        return (common as Record<string, number | null | undefined>)[key] ?? null;
      }
      const source =
        which === "base" ? baseVals : which === "rounded" ? roundedVals : flooredVals;
      return (source as Record<string, number | null | undefined>)[key] ?? null;
    };

    return rows.map((r) => ({
      ...r,
      base: getValue("base", r.key),
      rounded: getValue("rounded", r.key),
      floored: getValue("floored", r.key)
    }));
  }, [
    baseVals,
    roundedVals,
    flooredVals,
    scenario.config.mortalityAsPercent,
    scenario.inputs.sn10FarmCapacity,
    scenario.inputs.sn11NumberOfHouses,
    scenario.inputs.sn12HouseArea,
    scenario.inputs.sn2HarvestBirdAvgWeight,
    scenario.inputs.sn4PlannedMortality,
    scenario.inputs.sn6CycleTimeDays,
    uomForSn1
  ]);

  const handleDownloadCsv = () => {
    const headers = [
      "Parameter",
      "UOM",
      "Base (exact farms)",
      "Rounded up farms",
      "Floored farms"
    ];

    const rows: string[][] = [
      headers,
      ...fullParametersRows.map((r) => [
        r.label,
        r.uom,
        formatNumber(r.base ?? undefined, { maximumFractionDigits: 6 }),
        formatNumber(r.rounded ?? undefined, { maximumFractionDigits: 6 }),
        formatNumber(r.floored ?? undefined, { maximumFractionDigits: 6 })
      ])
    ];

    const escapeCsv = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;

    const csvContent = rows
      .map((row) => row.map((cell) => escapeCsv(cell ?? "")).join(","))
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(
      now.getHours()
    ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    a.href = url;
    a.download = `broiler_scenarios_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="main">
      <div className="main-header-row">
        <h1 className="page-title">Broiler Planning Parameters</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveScenario}
        >
          Generate Scenarios
        </button>
      </div>

      {saveMessage && <div className="banner">{saveMessage}</div>}

      <div className="card-grid">
        <Card title="Scenario Setup">
          <div className="form-grid">
            <div className="form-field">
              <label>
                Scenario Name
                <input
                  type="text"
                  value={scenario.name}
                  onChange={(e) =>
                    handleScenarioMetaChange("name", e.target.value)
                  }
                  placeholder="e.g. 2026 – Base Broiler Capacity"
                />
              </label>
              {validationErrors.scenarioName && (
                <div className="field-error">{validationErrors.scenarioName}</div>
              )}
            </div>
            <div className="form-field">
              <label>
                Description (optional)
                <input
                  type="text"
                  value={scenario.description ?? ""}
                  onChange={(e) =>
                    handleScenarioMetaChange("description", e.target.value)
                  }
                  placeholder="Short note about this scenario"
                />
              </label>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>
                Time Horizon
                <select
                  value={scenario.timeHorizon}
                  onChange={(e) =>
                    handleScenarioMetaChange(
                      "timeHorizon",
                      e.target.value as BroilerScenario["timeHorizon"]
                    )
                  }
                >
                  <option value="year">Per year</option>
                  <option value="threeYears">3 years</option>
                  <option value="customDays">Custom days</option>
                </select>
              </label>
            </div>
            {scenario.timeHorizon === "customDays" && (
              <div className="form-field">
                <label>
                  Custom Horizon (days)
                  <input
                    type="number"
                    value={scenario.customDays ?? ""}
                    onChange={(e) =>
                      setScenario((prev) => ({
                        ...prev,
                        customDays:
                          e.target.value === "" ? undefined : Number(e.target.value)
                      }))
                    }
                  />
                </label>
              </div>
            )}
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>
                Units Mode
                <select
                  value={scenario.config.unitsMode}
                  onChange={(e) =>
                    handleConfigChange({
                      unitsMode: e.target.value as UnitsModeKey
                    })
                  }
                >
                  <option value="tonsPerYear_kgPerBird">
                    SN1 in Tons/year, SN2 in kg/bird
                  </option>
                  <option value="kgPerYear_kgPerBird">
                    SN1 in kg/year, SN2 in kg/bird
                  </option>
                  <option value="meatTonsWithYield">
                    SN1 is meat/carcass tons (Yield%)
                  </option>
                </select>
              </label>
              <div className="field-hint">
                Current mode: {unitsModeLabel(scenario.config.unitsMode)}
              </div>
            </div>
          </div>

          <div className="toggle-row">
            <ToggleSwitch
              label="Use Yield %"
              checked={scenario.config.useYield}
              onChange={(checked) => handleConfigChange({ useYield: checked })}
              description="When enabled, SN1 is carcass meat and live weight is adjusted by Yield%."
            />
            <ToggleSwitch
              label="Full Cycles Only"
              checked={scenario.config.useFullCyclesOnly}
              onChange={(checked) =>
                handleConfigChange({ useFullCyclesOnly: checked })
              }
              description="Rounds down cycles per year to full cycles."
            />
          </div>
          <div className="toggle-row">
            <ToggleSwitch
              label="Use 365.25 days/year"
              checked={scenario.config.useLeapYearCycles}
              onChange={(checked) =>
                handleConfigChange({ useLeapYearCycles: checked })
              }
              description="Use leap-year adjusted year length in cycle calculations."
            />
            <ToggleSwitch
              label="Mortality entered as percent"
              checked={scenario.config.mortalityAsPercent}
              onChange={(checked) =>
                handleConfigChange({ mortalityAsPercent: checked })
              }
              description="If disabled, SN4 is interpreted as a fraction (e.g. 0.05 for 5%)."
            />
          </div>

          {scenario.config.useYield && (
            <div className="form-grid">
              <div className="form-field">
                <label>
                  Yield %
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={scenario.inputs.yieldPercent ?? ""}
                      onChange={(e) =>
                        handleInputChange("yieldPercent", e.target.value)
                      }
                      min={0}
                      max={100}
                    />
                    <span className="input-unit">%</span>
                  </div>
                </label>
                {validationErrors.yieldPercent && (
                  <div className="field-error">
                    {validationErrors.yieldPercent}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Broiler Inputs">
          <div className="form-grid broiler-inputs-grid">
            {[
              {
                sn: "SN1",
                key: "sn1TargetBroilerMeat",
                label: "Target Broiler Meat",
                unit:
                  scenario.config.unitsMode === "kgPerYear_kgPerBird"
                    ? "kg/year"
                    : "tons/year"
              },
              {
                sn: "SN2",
                key: "sn2HarvestBirdAvgWeight",
                label: "Harvest Birds Average Weight",
                unit: "kg/bird"
              },
              {
                sn: "SN4",
                key: "sn4PlannedMortality",
                label: "Planned Mortality",
                unit: scenario.config.mortalityAsPercent ? "% birds" : "fraction"
              },
              {
                sn: "SN6",
                key: "sn6CycleTimeDays",
                label: "Broiler Cycle Time",
                unit: "days"
              },
              {
                sn: "SN10",
                key: "sn10FarmCapacity",
                label: "Broiler Farm Capacity",
                unit: "birds/cycle"
              },
              {
                sn: "SN11",
                key: "sn11NumberOfHouses",
                label: "Broiler No. of Houses",
                unit: "houses"
              },
              {
                sn: "SN12",
                key: "sn12HouseArea",
                label: "Broiler House Area",
                unit: "m²"
              }
            ].map((row) => {
              const value =
                scenario.inputs[row.key as keyof BroilerInputs] ?? "";
              const error = validationErrors[row.key];
              return (
                <div key={row.sn} className="form-field">
                  <label>
                    {row.label}
                    <div className="input-with-unit">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          handleInputChange(
                            row.key as keyof BroilerInputs,
                            e.target.value
                          )
                        }
                      />
                      <span className="input-unit">{row.unit}</span>
                    </div>
                  </label>
                  {error && <div className="field-error">{error}</div>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Results & Analysis">
          {results.hasDivisionByZero && (
            <div className="banner banner-warning">
              Some results could not be calculated due to invalid inputs or
              division by zero. Please review your assumptions.
            </div>
          )}

          <div className="results-topbar">
            <div className="results-topbar-title">
              <div className="results-title">Results & Analysis</div>
              <div className="results-subtitle">Last updated: {lastUpdatedAt}</div>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleDownloadCsv}>
              Download Results
            </button>
          </div>

          <div className="scenario-cards">
            <button
              type="button"
              className={`scenario-card ${activeScenarioView === "base" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("base")}
            >
              <div className="scenario-card-title">Base Performance</div>
              <div className="scenario-card-metrics">
                <div className="scenario-card-row">
                  <span>Farms</span>
                  <span className="mono">
                    {formatNumber(baseVals.sn14 ?? undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Target Meat</span>
                  <span className="mono">
                    {formatNumber(baseVals.sn1 ?? undefined, { maximumFractionDigits: 3 })} {uomForSn1}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Placement/cycle</span>
                  <span className="mono">
                    {formatNumber(baseVals.sn9 ?? undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`scenario-card scenario-card-warn ${activeScenarioView === "rounded" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("rounded")}
            >
              <div className="scenario-card-title">Rounded Performance</div>
              <div className="scenario-card-metrics">
                <div className="scenario-card-row">
                  <span>Farms</span>
                  <span className="mono">
                    {roundedScenario?.farms != null ? Math.ceil(roundedScenario.farms).toString() : "—"}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Target Meat</span>
                  <span className="mono">
                    {formatNumber(roundedVals.sn1 ?? undefined, { maximumFractionDigits: 3 })} {uomForSn1}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Placement/cycle</span>
                  <span className="mono">
                    {formatNumber(roundedVals.sn9 ?? undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`scenario-card ${activeScenarioView === "floored" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("floored")}
            >
              <div className="scenario-card-title">Floored Performance</div>
              <div className="scenario-card-metrics">
                <div className="scenario-card-row">
                  <span>Farms</span>
                  <span className="mono">
                    {flooredScenario?.farms != null ? Math.floor(flooredScenario.farms).toString() : "—"}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Target Meat</span>
                  <span className="mono">
                    {formatNumber(flooredVals.sn1 ?? undefined, { maximumFractionDigits: 3 })} {uomForSn1}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Placement/cycle</span>
                  <span className="mono">
                    {formatNumber(flooredVals.sn9 ?? undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`scenario-card scenario-card-combined ${activeScenarioView === "combined" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("combined")}
            >
              <div className="scenario-card-title">Combined</div>
              <div className="scenario-card-metrics">
                <div className="scenario-card-row">
                  <span>Scenarios</span>
                  <span className="mono">3</span>
                </div>
                <div className="scenario-card-row">
                  <span>Farms range</span>
                  <span className="mono">
                    {baseVals.sn14 != null && flooredVals.sn14 != null && roundedVals.sn14 != null
                      ? `${formatNumber(flooredVals.sn14, { maximumFractionDigits: 2 })} – ${formatNumber(roundedVals.sn14, { maximumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </div>
                <div className="scenario-card-row">
                  <span>Target Meat range</span>
                  <span className="mono">
                    {flooredVals.sn1 != null && roundedVals.sn1 != null
                      ? `${formatNumber(flooredVals.sn1, { maximumFractionDigits: 3 })} – ${formatNumber(roundedVals.sn1, { maximumFractionDigits: 3 })} ${uomForSn1}`
                      : "—"}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <div className="scenario-view-buttons">
            <button
              type="button"
              className={`pill ${activeScenarioView === "base" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("base")}
            >
              Base
            </button>
            <button
              type="button"
              className={`pill ${activeScenarioView === "rounded" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("rounded")}
            >
              Rounded
            </button>
            <button
              type="button"
              className={`pill ${activeScenarioView === "floored" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("floored")}
            >
              Floored
            </button>
            <button
              type="button"
              className={`pill ${activeScenarioView === "combined" ? "active" : ""}`}
              onClick={() => setActiveScenarioView("combined")}
            >
              All Combined
            </button>
          </div>

          <div className="results-tabs">
            <button
              type="button"
              className={`tab ${activeResultsTab === "fullParameters" ? "active" : ""}`}
              onClick={() => setActiveResultsTab("fullParameters")}
            >
              Full Parameters
            </button>
            <button
              type="button"
              className={`tab ${activeResultsTab === "summary" ? "active" : ""}`}
              onClick={() => setActiveResultsTab("summary")}
            >
              Summary
            </button>
          </div>

          {activeResultsTab === "fullParameters" && (
            <div className="results-table">
              <div className="results-header">
                <span>Parameter</span>
                <span>UOM</span>
                {activeScenarioView === "combined" ? (
                  <>
                    <span>Base</span>
                    <span>Rounded</span>
                    <span>Floored</span>
                  </>
                ) : (
                  <span>Value</span>
                )}
              </div>

              {fullParametersRows.map((r) => {
                const decimals =
                  r.key === "sn7"
                    ? scenario.config.useFullCyclesOnly
                      ? 0
                      : 2
                    : r.key === "sn13"
                      ? 2
                      : r.key === "sn14"
                        ? 3
                        : r.key === "sn2"
                          ? 3
                          : 0;

                const pick = (which: "base" | "rounded" | "floored") =>
                  formatNumber(
                    (which === "base" ? r.base : which === "rounded" ? r.rounded : r.floored) ??
                      undefined,
                    { maximumFractionDigits: decimals }
                  );

                return (
                  <div key={r.key} className="results-row">
                    <span className="results-label">{r.label}</span>
                    <span className="results-unit">{r.uom}</span>
                    {activeScenarioView === "combined" ? (
                      <>
                        <span className="results-value">{pick("base")}</span>
                        <span className="results-value">{pick("rounded")}</span>
                        <span className="results-value">{pick("floored")}</span>
                      </>
                    ) : (
                      <span className="results-value">
                        {activeScenarioView === "base"
                          ? pick("base")
                          : activeScenarioView === "rounded"
                            ? pick("rounded")
                            : pick("floored")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeResultsTab === "summary" && (
            <div className="results-table">
              <div className="results-header">
                <span>Metric</span>
                <span>UOM</span>
                {activeScenarioView === "combined" ? (
                  <>
                    <span>Base</span>
                    <span>Rounded</span>
                    <span>Floored</span>
                  </>
                ) : (
                  <span>Value</span>
                )}
              </div>

              {[
                { label: "Farms needed", uom: "farms", key: "sn14" as const, decimals: 2 },
                { label: "Target Broiler Meat", uom: uomForSn1, key: "sn1" as const, decimals: 3 },
                { label: "Placement per cycle", uom: "birds/cycle", key: "sn9" as const, decimals: 0 },
                { label: "Harvest birds per year", uom: "birds/year", key: "sn3" as const, decimals: 0 },
                { label: "Density", uom: "birds/m²", key: "sn13" as const, decimals: 2 }
              ].map((metric) => {
                const get = (which: "base" | "rounded" | "floored") => {
                  const src =
                    which === "base"
                      ? baseVals
                      : which === "rounded"
                        ? roundedVals
                        : flooredVals;
                  return formatNumber(
                    (src as Record<string, number | null | undefined>)[metric.key] ?? undefined,
                    { maximumFractionDigits: metric.decimals }
                  );
                };

                return (
                  <div key={metric.key} className="results-row">
                    <span className="results-label">{metric.label}</span>
                    <span className="results-unit">{metric.uom}</span>
                    {activeScenarioView === "combined" ? (
                      <>
                        <span className="results-value">{get("base")}</span>
                        <span className="results-value">{get("rounded")}</span>
                        <span className="results-value">{get("floored")}</span>
                      </>
                    ) : (
                      <span className="results-value">
                        {activeScenarioView === "base"
                          ? get("base")
                          : activeScenarioView === "rounded"
                            ? get("rounded")
                            : get("floored")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};

