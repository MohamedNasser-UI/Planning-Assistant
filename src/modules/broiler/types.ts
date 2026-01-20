export type UnitsModeKey =
  | "tonsPerYear_kgPerBird"
  | "kgPerYear_kgPerBird"
  | "meatTonsWithYield";

export interface BroilerInputs {
  sn1TargetBroilerMeat: number | null;
  sn2HarvestBirdAvgWeight: number | null;
  sn4PlannedMortality: number | null;
  sn6CycleTimeDays: number | null;
  sn10FarmCapacity: number | null;
  sn11NumberOfHouses: number | null;
  sn12HouseArea: number | null;
  yieldPercent: number | null;
}

export interface BroilerConfig {
  unitsMode: UnitsModeKey;
  useYield: boolean;
  useFullCyclesOnly: boolean;
  useLeapYearCycles: boolean;
  mortalityAsPercent: boolean;
}

export interface BroilerScenario {
  id: string;
  name: string;
  description?: string;
  timeHorizon: "year" | "threeYears" | "customDays";
  customDays?: number;
  createdAt: string;
  inputs: BroilerInputs;
  config: BroilerConfig;
}

export interface BroilerResults {
  sn3HarvestBirdsNumber?: number;
  sn5OverallPlacement?: number;
  sn7CyclesPerYear?: number;
  sn8HarvestPerCycle?: number;
  sn9PlacementPerCycle?: number;
  sn13Density?: number;
  sn14NumberOfFarms?: number;
  hasDivisionByZero: boolean;
}

