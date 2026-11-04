/**
 * Global operational and security limits for DevCollab.
 */

// Room & Membership
export const MAX_ROOM_MEMBERS = 25;

// Code & Documents
export const MAX_CODE_CHARS = 200000;

// Snapshots
export const MAX_SNAPSHOTS_PER_ROOM = 50;
export const MAX_SNAPSHOT_CODE_CHARS = 200000;
export const MAX_SNAPSHOT_NAME_CHARS = 80;

// Invites
export const MIN_INVITE_HOURS = 1;
export const DEFAULT_INVITE_HOURS = 168; // 7 days
export const MAX_INVITE_HOURS = 720;     // 30 days
export const MIN_INVITE_USES = 1;
export const MAX_INVITE_USES = 100;

// Execution & Test Cases
export const MAX_STDIN_CHARS = 10000;
export const MAX_STDOUT_CHARS = 100000;
export const MAX_STDERR_CHARS = 100000;
export const MAX_TEST_CASES = 10;
export const MAX_TEST_NAME_CHARS = 60;
export const MAX_TEST_INPUT_CHARS = 2000;

// Rate Limits
export const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: "Too many login/registration attempts, please try again later",
  },
  run: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: "Execution rate limit exceeded (30 runs per minute)",
  },
  comments: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: "Comment rate limit exceeded (30 comments per minute)",
  },
  inviteAccept: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Invite rate limit exceeded (20 per hour)",
  },
  inviteCreate: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Invite creation rate limit exceeded (20 per hour)",
  },
  snapshots: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Snapshot operation rate limit exceeded (20 per hour)",
  },
};

