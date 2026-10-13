// Synthetic records in Garmin Account Management export layouts. No user data.
export const daily = { calendarDate: '2026-10-11', totalSteps: 8765,
  totalKilocalories: 2570, activeKilocalories: 630, restingHeartRate: 57,
  minHeartRate: 48, maxHeartRate: 172, userProfileId: 999,
  privateAccountField: 'must never persist' };
export const sleep = { calendarDate: '2026-10-11', deepSleepSeconds: 5400,
  lightSleepSeconds: 14400, remSleepSeconds: 7200, awakeSleepSeconds: 900 };
export const workout = { activityId: 123456789, activityType: 'running',
  startTimeGmt: 1791678600000, startTimeLocal: 1791693000000,
  duration: 2520000, distance: 710000, calories: 540, avgHr: 152, maxHr: 172,
  name: 'A name containing my home address', startLatitude: 24.4, startLongitude: 54.3 };
export const documents = [
  { name: 'DI_CONNECT/DI-Connect-Aggregator/UDSFile_2026.json', data: [daily] },
  { name: 'DI_CONNECT/DI-Connect-Wellness/2026_sleepData.json', data: [sleep] },
  { name: 'DI_CONNECT/DI-Connect-Fitness/999_summarizedActivities.json', data: [{ summarizedActivitiesExport: [workout] }] },
];
