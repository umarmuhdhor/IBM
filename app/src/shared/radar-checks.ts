export type RadarChecks = {
  // null when Bob Shell is not installed or did not answer in time.
  bobVersion: string | null
  // null when no workspace folder was given.
  bobSettings: boolean | null
}
