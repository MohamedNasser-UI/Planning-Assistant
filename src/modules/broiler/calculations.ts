import type {
  BroilerInputs,
  BroilerConfig,
  BroilerResults,
  UnitsModeKey
} from "./types";

function safeNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function computeBroilerResults(
  rawInputs: BroilerInputs,
  config: BroilerConfig
): BroilerResults {
  const inputs: BroilerInputs = {
    sn1TargetBroilerMeat: safeNumber(rawInputs.sn1TargetBroilerMeat),
    sn2HarvestBirdAvgWeight: safeNumber(rawInputs.sn2HarvestBirdAvgWeight),
    sn4PlannedMortality: safeNumber(rawInputs.sn4PlannedMortality),
    sn6CycleTimeDays: safeNumber(rawInputs.sn6CycleTimeDays),
    sn10FarmCapacity: safeNumber(rawInputs.sn10FarmCapacity),
    sn11NumberOfHouses: safeNumber(rawInputs.sn11NumberOfHouses),
    sn12HouseArea: safeNumber(rawInputs.sn12HouseArea),
    yieldPercent: safeNumber(rawInputs.yieldPercent)
  };

  let hasDivisionByZero = false;

  const mortalityFraction = (() => {
    const raw = inputs.sn4PlannedMortality;
    if (raw == null) return null;
    if (config.mortalityAsPercent) {
      if (raw <= 0) return 0;
      return raw / 100;
    }
    return raw;
  })();

  const mortalityValid =
    mortalityFraction == null ||
    (mortalityFraction >= 0 && mortalityFraction < 1);

  // SN3
  let sn3HarvestBirdsNumber: number | undefined;
  if (
    inputs.sn1TargetBroilerMeat != null &&
    inputs.sn2HarvestBirdAvgWeight != null
  ) {
    const sn1 = inputs.sn1TargetBroilerMeat;
    const sn2 = inputs.sn2HarvestBirdAvgWeight;
    if (sn2 === 0) {
      hasDivisionByZero = true;
    } else {
      let birds: number | null = null;
      if (config.unitsMode === "tonsPerYear_kgPerBird") {
        birds = (sn1 * 1000) / sn2;
      } else if (config.unitsMode === "kgPerYear_kgPerBird") {
        birds = sn1 / sn2;
      } else if (config.unitsMode === "meatTonsWithYield" && config.useYield) {
        const yieldPct =
          inputs.yieldPercent != null && inputs.yieldPercent > 0
            ? inputs.yieldPercent
            : null;
        if (yieldPct == null) {
          birds = null;
        } else {
          birds = (sn1 * 1000 * (100 / yieldPct)) / sn2;
        }
      }
      if (birds != null && Number.isFinite(birds)) {
        sn3HarvestBirdsNumber = birds;
      }
    }
  }

  // SN5
  let sn5OverallPlacement: number | undefined;
  if (sn3HarvestBirdsNumber != null && mortalityFraction != null) {
    const denom = 1 - mortalityFraction;
    if (denom === 0) {
      hasDivisionByZero = true;
    } else {
      sn5OverallPlacement = sn3HarvestBirdsNumber / denom;
    }
  }

  // SN7
  let sn7CyclesPerYear: number | undefined;
  if (inputs.sn6CycleTimeDays != null) {
    const daysPerYear = config.useLeapYearCycles ? 365.25 : 365;
    const denom = inputs.sn6CycleTimeDays;
    if (denom === 0) {
      hasDivisionByZero = true;
    } else {
      let value = daysPerYear / denom;
      if (config.useFullCyclesOnly) {
        value = Math.floor(value);
      }
      sn7CyclesPerYear = value;
    }
  }

  // SN8
  let sn8HarvestPerCycle: number | undefined;
  if (sn3HarvestBirdsNumber != null && sn7CyclesPerYear != null) {
    if (sn7CyclesPerYear === 0) {
      hasDivisionByZero = true;
    } else {
      sn8HarvestPerCycle = sn3HarvestBirdsNumber / sn7CyclesPerYear;
    }
  }

  // SN9
  let sn9PlacementPerCycle: number | undefined;
  if (sn8HarvestPerCycle != null && mortalityFraction != null) {
    const denom = 1 - mortalityFraction;
    if (denom === 0) {
      hasDivisionByZero = true;
    } else {
      sn9PlacementPerCycle = sn8HarvestPerCycle / denom;
    }
  }

  // SN13
  let sn13Density: number | undefined;
  if (
    inputs.sn10FarmCapacity != null &&
    inputs.sn11NumberOfHouses != null &&
    inputs.sn12HouseArea != null
  ) {
    const denom = inputs.sn11NumberOfHouses * inputs.sn12HouseArea;
    if (denom === 0) {
      hasDivisionByZero = true;
    } else {
      sn13Density = inputs.sn10FarmCapacity / denom;
    }
  }

  // SN14
  let sn14NumberOfFarms: number | undefined;
  if (sn9PlacementPerCycle != null && inputs.sn10FarmCapacity != null) {
    const denom = inputs.sn10FarmCapacity;
    if (denom === 0) {
      hasDivisionByZero = true;
    } else {
      sn14NumberOfFarms = sn9PlacementPerCycle / denom;
    }
  }

  // If mortality invalid, flag division risk but keep values null
  if (!mortalityValid) {
    hasDivisionByZero = true;
  }

  return {
    sn3HarvestBirdsNumber,
    sn5OverallPlacement,
    sn7CyclesPerYear,
    sn8HarvestPerCycle,
    sn9PlacementPerCycle,
    sn13Density,
    sn14NumberOfFarms,
    hasDivisionByZero
  };
}

function invertSn3ToSn1(
  sn3HarvestBirdsNumber: number,
  inputs: BroilerInputs,
  config: BroilerConfig
): number | null {
  const sn2 = inputs.sn2HarvestBirdAvgWeight;
  if (sn2 == null || sn2 === 0) return null;

  const mode: UnitsModeKey = config.unitsMode;
  if (mode === "tonsPerYear_kgPerBird") {
    return (sn3HarvestBirdsNumber * sn2) / 1000;
  }
  if (mode === "kgPerYear_kgPerBird") {
    return sn3HarvestBirdsNumber * sn2;
  }
  if (mode === "meatTonsWithYield" && config.useYield) {
    const yieldPercent = inputs.yieldPercent;
    if (!yieldPercent || yieldPercent <= 0) return null;
    // Reverse of: SN3 = (SN1 * 1000 * (100 / yield%)) / SN2
    return (
      (sn3HarvestBirdsNumber * sn2 * yieldPercent) /
      (100 * 1000)
    );
  }
  return null;
}

export interface FarmsScenarioRow {
  label: string;
  farms: number | null;
  sn1TargetBroilerMeat: number | null;
  sn3HarvestBirdsNumber: number | null;
  sn9PlacementPerCycle: number | null;
}

export function buildFarmScenarios(
  inputs: BroilerInputs,
  config: BroilerConfig,
  baseResults: BroilerResults
): FarmsScenarioRow[] {
  const rows: FarmsScenarioRow[] = [];
  const baseFarms = baseResults.sn14NumberOfFarms;
  const mFraction = (() => {
    const raw = inputs.sn4PlannedMortality;
    if (raw == null) return null;
    if (config.mortalityAsPercent) return raw / 100;
    return raw;
  })();
  const sn7 = baseResults.sn7CyclesPerYear;
  const sn10 = inputs.sn10FarmCapacity;

  const makeRowForFarms = (label: string, farms: number | null): FarmsScenarioRow => {
    if (
      farms == null ||
      !Number.isFinite(farms) ||
      farms <= 0 ||
      sn10 == null ||
      sn10 <= 0 ||
      mFraction == null ||
      mFraction < 0 ||
      mFraction >= 1 ||
      sn7 == null ||
      sn7 <= 0
    ) {
      return {
        label,
        farms: farms ?? null,
        sn1TargetBroilerMeat: null,
        sn3HarvestBirdsNumber: null,
        sn9PlacementPerCycle: null
      };
    }

    const sn9PlacementPerCycle = farms * sn10;
    const sn8HarvestPerCycle = sn9PlacementPerCycle * (1 - mFraction);
    const sn3HarvestBirdsNumber = sn8HarvestPerCycle * sn7;
    const sn1TargetBroilerMeat = invertSn3ToSn1(
      sn3HarvestBirdsNumber,
      inputs,
      config
    );

    return {
      label,
      farms,
      sn1TargetBroilerMeat,
      sn3HarvestBirdsNumber,
      sn9PlacementPerCycle
    };
  };

  rows.push(
    makeRowForFarms("Base (exact farms)", baseFarms ?? null),
    makeRowForFarms(
      "Rounded up farms",
      baseFarms != null ? Math.ceil(baseFarms) : null
    ),
    makeRowForFarms(
      "Floored farms",
      baseFarms != null ? Math.floor(baseFarms) : null
    )
  );

  return rows;
}

export function formatNumber(
  value: number | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", options).format(value);
}

