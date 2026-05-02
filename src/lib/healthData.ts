import { Platform } from "react-native";
import type {
  AppleHealthKit,
  HealthKitPermissions,
  HealthPermission,
  HealthValue,
} from "react-native-health";
import type { Permission, RecordResult, RecordType } from "react-native-health-connect";

/** Unified health sample for sync + AI context */
export interface HealthDataPoint {
  type: HealthMetricType;
  value: number | string;
  unit: string;
  startDate: string;
  endDate: string;
  source: HealthPlatformSource;
}

export type HealthPlatformSource = "healthkit" | "health_connect";

export type HealthMetricType =
  | "heart_rate"
  | "hrv"
  | "resting_heart_rate"
  | "steps"
  | "basal_body_temperature"
  | "body_temperature"
  | "active_energy"
  | "sleep"
  | "menstrual_flow";

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function numericTimestampToIso(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toISOString();
}

/** iOS HealthKit module (native dev build only). */
function getIosHealthKit(): typeof import("@kayzmann/expo-healthkit") | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("@kayzmann/expo-healthkit") as typeof import("@kayzmann/expo-healthkit");
  } catch {
    return null;
  }
}

/** iOS: react-native-health (patched) for HKCategory samples such as menstrual flow. */
function getIosReactNativeHealth(): AppleHealthKit | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("react-native-health") as AppleHealthKit;
  } catch {
    return null;
  }
}

type MenstrualFlowSample = HealthValue & { valueString: string };

/** Request read access for MenstrualFlow (additive to expo-healthkit grants). */
async function initIosMenstrualHealthKit(): Promise<void> {
  const hk = getIosReactNativeHealth();
  if (!hk) return;

  await new Promise<void>((resolve) => {
    hk.initHealthKit(
      {
        permissions: {
          read: ["MenstrualFlow"] as HealthPermission[],
          write: [],
        },
      } satisfies HealthKitPermissions,
      (err: string | null) => {
        if (err) {
          console.warn("[healthData] MenstrualFlow HealthKit init:", err);
        }
        resolve();
      },
    );
  });
}

/** Android Health Connect module */
function getAndroidHealthConnect(): typeof import("react-native-health-connect") | null {
  if (Platform.OS !== "android") return null;
  try {
    return require("react-native-health-connect") as typeof import("react-native-health-connect");
  } catch {
    return null;
  }
}

const ANDROID_READ_PERMISSIONS: Permission[] = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "HeartRate" },
  { accessType: "read", recordType: "RestingHeartRate" },
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "BasalBodyTemperature" },
  { accessType: "read", recordType: "BodyTemperature" },
  { accessType: "read", recordType: "MenstruationFlow" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
];

const IOS_READ_TYPES: Array<
  | "HeartRate"
  | "RestingHeartRate"
  | "Steps"
  | "Sleep"
  | "BodyTemperature"
  | "ActiveEnergy"
  | "HRV"
> = ["HeartRate", "RestingHeartRate", "Steps", "Sleep", "BodyTemperature", "ActiveEnergy", "HRV"];

export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "ios") {
    const kit = getIosHealthKit();
    if (!kit?.isAvailable()) return false;
    try {
      await kit.requestAuthorization(IOS_READ_TYPES, []);
      await initIosMenstrualHealthKit();
      return true;
    } catch {
      return false;
    }
  }

  if (Platform.OS === "android") {
    const hc = getAndroidHealthConnect();
    if (!hc) return false;
    try {
      const status = await hc.getSdkStatus();
      const { SdkAvailabilityStatus } = hc;
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        return false;
      }
      const ok = await hc.initialize();
      if (!ok) return false;
      await hc.requestPermission(ANDROID_READ_PERMISSIONS);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export async function checkHealthPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    const hc = getAndroidHealthConnect();
    if (!hc) return false;
    try {
      const granted = await hc.getGrantedPermissions();
      return Array.isArray(granted) && granted.length > 0;
    } catch {
      return false;
    }
  }

  if (Platform.OS === "ios") {
    const kit = getIosHealthKit();
    return Boolean(kit?.isAvailable());
  }

  return false;
}

async function fetchIosRange(startDate: Date, endDate: Date): Promise<{
  heartRate: HealthDataPoint[];
  hrv: HealthDataPoint[];
  sleep: HealthDataPoint[];
  steps: HealthDataPoint[];
  temperature: HealthDataPoint[];
  menstrualFlow: HealthDataPoint[];
  restingHeartRate: HealthDataPoint[];
  activeEnergy: HealthDataPoint[];
}> {
  const kit = getIosHealthKit();
  const out = {
    heartRate: [] as HealthDataPoint[],
    hrv: [] as HealthDataPoint[],
    sleep: [] as HealthDataPoint[],
    steps: [] as HealthDataPoint[],
    temperature: [] as HealthDataPoint[],
    menstrualFlow: [] as HealthDataPoint[],
    restingHeartRate: [] as HealthDataPoint[],
    activeEnergy: [] as HealthDataPoint[],
  };
  if (!kit?.isAvailable()) return out;

  const source: HealthPlatformSource = "healthkit";

  const dayWalk = new Date(startDate);
  dayWalk.setHours(0, 0, 0, 0);
  const endWalk = new Date(endDate);
  endWalk.setHours(23, 59, 59, 999);
  while (dayWalk <= endWalk) {
    const { start, end } = localDayBounds(dayWalk);
    const dayStr = isoDay(dayWalk);
    try {
      const stepsVal = await kit.getSteps(start, end);
      out.steps.push({
        type: "steps",
        value: Math.round(stepsVal),
        unit: "count",
        startDate: dayStr + "T12:00:00.000Z",
        endDate: dayStr + "T12:00:00.000Z",
        source,
      });
    } catch {
      /* ignore day */
    }
    try {
      const rhr = await kit.getRestingHeartRate(start, end);
      if (rhr != null) {
        out.restingHeartRate.push({
          type: "resting_heart_rate",
          value: rhr,
          unit: "bpm",
          startDate: dayStr + "T12:00:00.000Z",
          endDate: dayStr + "T12:00:00.000Z",
          source,
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const cals = await kit.getTotalCalories(start, end);
      if (cals > 0) {
        out.activeEnergy.push({
          type: "active_energy",
          value: Math.round(cals * 10) / 10,
          unit: "kcal",
          startDate: dayStr + "T12:00:00.000Z",
          endDate: dayStr + "T12:00:00.000Z",
          source,
        });
      }
    } catch {
      /* ignore */
    }
    dayWalk.setDate(dayWalk.getDate() + 1);
  }

  const hrSamples = await kit.getHeartRateSamples(startDate, endDate, 2000);
  const iosHrByDay = new Map<string, number[]>();
  for (const s of hrSamples) {
    const day = isoDay(new Date(numericTimestampToIso(s.startDate)));
    const arr = iosHrByDay.get(day) ?? [];
    arr.push(s.value);
    iosHrByDay.set(day, arr);
  }
  for (const [day, bpms] of iosHrByDay) {
    const avg = bpms.reduce((a, b) => a + b, 0) / bpms.length;
    out.heartRate.push({
      type: "heart_rate",
      value: Math.round(avg * 10) / 10,
      unit: "bpm",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const sleepSamples = await kit.getSleepSamples(startDate, endDate);
  const sleepByDay = new Map<string, number>();
  for (const s of sleepSamples) {
    const day = isoDay(new Date(numericTimestampToIso(s.startDate)));
    const add = (s.duration || 0) / 3600;
    sleepByDay.set(day, (sleepByDay.get(day) ?? 0) + add);
  }
  for (const [day, hours] of sleepByDay) {
    out.sleep.push({
      type: "sleep",
      value: hours,
      unit: "h",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const rnHealth = getIosReactNativeHealth();
  if (rnHealth) {
    await new Promise<void>((resolve) => {
      rnHealth.getMenstrualFlowSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        (err: string | null, results: MenstrualFlowSample[]) => {
          if (!err && results?.length) {
            for (const s of results) {
              const day = s.startDate.split("T")[0]!;
              const flowLabel = s.valueString || String(s.value);
              out.menstrualFlow.push({
                type: "menstrual_flow",
                value: flowLabel,
                unit: "category",
                startDate: day + "T12:00:00.000Z",
                endDate: day + "T12:00:00.000Z",
                source,
              });
            }
          }
          resolve();
        },
      );
    });
  }

  return out;
}

async function fetchAndroidRange(startDate: Date, endDate: Date): Promise<{
  heartRate: HealthDataPoint[];
  hrv: HealthDataPoint[];
  sleep: HealthDataPoint[];
  steps: HealthDataPoint[];
  temperature: HealthDataPoint[];
  menstrualFlow: HealthDataPoint[];
  restingHeartRate: HealthDataPoint[];
  activeEnergy: HealthDataPoint[];
}> {
  const hc = getAndroidHealthConnect();
  const out = {
    heartRate: [] as HealthDataPoint[],
    hrv: [] as HealthDataPoint[],
    sleep: [] as HealthDataPoint[],
    steps: [] as HealthDataPoint[],
    temperature: [] as HealthDataPoint[],
    menstrualFlow: [] as HealthDataPoint[],
    restingHeartRate: [] as HealthDataPoint[],
    activeEnergy: [] as HealthDataPoint[],
  };
  if (!hc) return out;

  const source: HealthPlatformSource = "health_connect";
  const range = {
    operator: "between" as const,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  const read = async <T extends RecordType>(recordType: T): Promise<RecordResult<T>[]> => {
    try {
      const res = await hc.readRecords(recordType, { timeRangeFilter: range });
      return res.records ?? [];
    } catch {
      return [];
    }
  };

  const stepsRecs = await read("Steps");
  const stepsByDay = new Map<string, number>();
  for (const r of stepsRecs) {
    const day = r.startTime.split("T")[0]!;
    stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + r.count);
  }
  for (const [day, count] of stepsByDay) {
    out.steps.push({
      type: "steps",
      value: count,
      unit: "count",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const hrRecs = await read("HeartRate");
  const hrByDay = new Map<string, number[]>();
  for (const r of hrRecs) {
    for (const s of r.samples ?? []) {
      const day = s.time.split("T")[0]!;
      const arr = hrByDay.get(day) ?? [];
      arr.push(s.beatsPerMinute);
      hrByDay.set(day, arr);
    }
  }
  for (const [day, bpms] of hrByDay) {
    const avg = bpms.reduce((a, b) => a + b, 0) / bpms.length;
    out.heartRate.push({
      type: "heart_rate",
      value: Math.round(avg * 10) / 10,
      unit: "bpm",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const rhrRecs = await read("RestingHeartRate");
  for (const r of rhrRecs) {
    const day = r.time.split("T")[0]!;
    out.restingHeartRate.push({
      type: "resting_heart_rate",
      value: r.beatsPerMinute,
      unit: "bpm",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const hrvRecs = await read("HeartRateVariabilityRmssd");
  const hrvByDay = new Map<string, number[]>();
  for (const r of hrvRecs) {
    const day = r.time.split("T")[0]!;
    const arr = hrvByDay.get(day) ?? [];
    arr.push(r.heartRateVariabilityMillis);
    hrvByDay.set(day, arr);
  }
  for (const [day, vals] of hrvByDay) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    out.hrv.push({
      type: "hrv",
      value: Math.round(avg),
      unit: "ms",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const sleepRecs = await read("SleepSession");
  const sleepByDay = new Map<string, number>();
  for (const r of sleepRecs) {
    const start = new Date(r.startTime).getTime();
    const end = new Date(r.endTime).getTime();
    const hours = Math.max(0, (end - start) / 3600000);
    const day = r.startTime.split("T")[0]!;
    sleepByDay.set(day, (sleepByDay.get(day) ?? 0) + hours);
  }
  for (const [day, hours] of sleepByDay) {
    out.sleep.push({
      type: "sleep",
      value: hours,
      unit: "h",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const bbtRecs = await read("BasalBodyTemperature");
  for (const r of bbtRecs) {
    const day = r.time.split("T")[0]!;
    const c = r.temperature.inCelsius;
    out.temperature.push({
      type: "basal_body_temperature",
      value: c,
      unit: "°C",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const btRecs = await read("BodyTemperature");
  for (const r of btRecs) {
    const day = r.time.split("T")[0]!;
    const c = r.temperature.inCelsius;
    out.temperature.push({
      type: "body_temperature",
      value: c,
      unit: "°C",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const menRecs = await read("MenstruationFlow");
  for (const r of menRecs) {
    const day = r.time.split("T")[0]!;
    out.menstrualFlow.push({
      type: "menstrual_flow",
      value: r.flow ?? "logged",
      unit: "category",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  const calRecs = await read("ActiveCaloriesBurned");
  for (const r of calRecs) {
    const day = r.startTime.split("T")[0]!;
    const kcal = r.energy.inKilocalories;
    out.activeEnergy.push({
      type: "active_energy",
      value: kcal,
      unit: "kcal",
      startDate: day + "T12:00:00.000Z",
      endDate: day + "T12:00:00.000Z",
      source,
    });
  }

  return out;
}

/** Last 7 days of samples (platform-specific). */
export async function fetchRecentHealthData(): Promise<{
  heartRate: HealthDataPoint[];
  hrv: HealthDataPoint[];
  sleep: HealthDataPoint[];
  steps: HealthDataPoint[];
  temperature: HealthDataPoint[];
  menstrualFlow: HealthDataPoint[];
  restingHeartRate: HealthDataPoint[];
  activeEnergy: HealthDataPoint[];
}> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  if (Platform.OS === "ios") {
    return fetchIosRange(startDate, endDate);
  }
  if (Platform.OS === "android") {
    return fetchAndroidRange(startDate, endDate);
  }

  return {
    heartRate: [],
    hrv: [],
    sleep: [],
    steps: [],
    temperature: [],
    menstrualFlow: [],
    restingHeartRate: [],
    activeEnergy: [],
  };
}

export async function fetchHealthData(
  _type: HealthMetricType,
  _startDate: Date,
  _endDate: Date,
): Promise<HealthDataPoint[]> {
  const all = await fetchRecentHealthData();
  const flat: HealthDataPoint[] = [
    ...all.heartRate,
    ...all.hrv,
    ...all.sleep,
    ...all.steps,
    ...all.temperature,
    ...all.menstrualFlow,
    ...all.restingHeartRate,
    ...all.activeEnergy,
  ];
  return flat.filter((p) => p.type === _type);
}

/** Reserved for writing cycle data back to Health (future). */
export async function writeMenstrualFlow(
  _date: Date,
  _flowIntensity: "light" | "medium" | "heavy",
): Promise<boolean> {
  return false;
}
