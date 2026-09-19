/**
 * Utility functions for timezone adjustments and date-time formatting.
 * Default timezone configured for GMT+7 (WIB / Western Indonesia Time).
 */

export const TIMEZONE_OFFSET_HOURS = 7;
export const TIMEZONE_OFFSET_SECONDS = TIMEZONE_OFFSET_HOURS * 3600;

export interface CurrentTimeInfo {
	hours: string;
	minutes: string;
	timeString: string;
	dateString: string;
}

/**
 * Returns formatted time and date adjusted to GMT+7.
 */
export function getGMT7TimeInfo(customUnixTime?: number): CurrentTimeInfo {
	const baseTime = customUnixTime ?? os.time();
	const gmt7Timestamp = baseTime + TIMEZONE_OFFSET_SECONDS;

	const hoursNum = math.floor(gmt7Timestamp / 3600) % 24;
	const minutesNum = math.floor(gmt7Timestamp / 60) % 60;

	const hours = tostring(hoursNum).size() < 2 ? `0${tostring(hoursNum)}` : tostring(hoursNum);
	const minutes = tostring(minutesNum).size() < 2 ? `0${tostring(minutesNum)}` : tostring(minutesNum);
	const timeString = `${hours}:${minutes}`;

	// Use DateTime for locale-accurate date string in universal time with the GMT+7 offset
	const dt = DateTime.fromUnixTimestamp(gmt7Timestamp);
	const dateString = dt.FormatUniversalTime("dddd, MMMM D", "en-us");

	return {
		hours,
		minutes,
		timeString,
		dateString,
	};
}
