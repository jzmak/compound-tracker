import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { USER_SEED } from "./userSeed.js";

/* ═══════════════════════════════════════════
   CONSTANTS & CONFIG
   ═══════════════════════════════════════════ */

const MS_PER_DAY = 86_400_000;
const MISSED_THRESHOLD_DAYS = 5;
const FATIGUE_WINDOW = 4;
const FATIGUE_RPE_THRESHOLD = 8;
const STREAK_LOOKBACK_WEEKS = 52;
const MIN_SESSIONS_PER_WEEK = 3;
const STORAGE_VERSION = 6;
const EDITABLE_SESSION_COUNT = 3;

const EXERCISES = {
  belt_squat:     { name: "Belt Squat",            bar: "none",     inc: 5,   repMin: 8,  repMax: 10, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 140, sW: 160 },
  lever_squat:    { name: "Lever Squat Machine",   bar: "none",     inc: 5,   repMin: 8,  repMax: 10, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 130, sW: 130, note: "total plates" },
  zercher_squat:  { name: "Zercher Squat",         bar: "barbell",  inc: 5,   repMin: 8,  repMax: 10, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 95,  sW: 115, note: "total incl. bar" },
  standing_press: { name: "Barbell Standing Press", bar: "barbell", inc: 2.5, repMin: 6,  repMax: 10, sRepMin: 4, sRepMax: 6,  sets: 3, resetPct: 0.075, stallN: 3, hW: 95,  sW: 110, note: "total incl. bar" },
  seated_press:   { name: "Seated Machine Press",  bar: "none",     inc: 5,   repMin: 6,  repMax: 10, sRepMin: 4, sRepMax: 6,  sets: 3, resetPct: 0.075, stallN: 3, hW: 120, sW: 120, note: "stack weight" },
  tbar_row:       { name: "Lying T-Bar Row",       bar: "none",     inc: 5,   repMin: 8,  repMax: 12, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 70,  sW: 80,  note: "plates only" },
  db_row:         { name: "Heavy Dumbbell Row",    bar: "dumbbell", inc: 5,   repMin: 8,  repMax: 12, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 70,  sW: 85,  note: "per dumbbell" },
  hex_deadlift:   { name: "Hex Bar Deadlift",      bar: "hex",      inc: 5,   repMin: 5,  repMax: 8,  sRepMin: 3, sRepMax: 5,  sets: 3, resetPct: 0.10,  stallN: 2, hW: 165, sW: 190, priority: true },
  incline_smith:  { name: "Incline Smith Press",   bar: "smith",    inc: 5,   repMin: 8,  repMax: 10, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.085, stallN: 3, hW: 90,  sW: 105, note: "plates only" },
  incline_db:     { name: "Incline Dumbbell Press", bar: "dumbbell", inc: 5,  repMin: 8,  repMax: 10, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.085, stallN: 3, hW: 50,  sW: 65,  note: "per dumbbell" },
  leg_press:      { name: "Leg Press",             bar: "none",     inc: 10,  repMin: 10, repMax: 15, sRepMin: 6, sRepMax: 10, sets: 3, resetPct: 0.10,  stallN: 3, hW: 225, sW: 260 },
  hack_squat:     { name: "Hack Squat Machine",    bar: "none",     inc: 10,  repMin: 10, repMax: 15, sRepMin: 6, sRepMax: 10, sets: 3, resetPct: 0.10,  stallN: 3, hW: 180, sW: 200, note: "total plates" },
  standing_ht:    { name: "Standing Hip Thrust",   bar: "none",     inc: 5,   repMin: 8,  repMax: 12, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 110, sW: 120, note: "Booty Builder, total plates" },
  ht_machine:     { name: "Hip Thrust Machine",    bar: "none",     inc: 5,   repMin: 8,  repMax: 12, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 110, sW: 120, note: "Platinum V4, total plates" },
  rdl_barbell:    { name: "Romanian Deadlift",     bar: "barbell",  inc: 5,   repMin: 8,  repMax: 12, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 95,  sW: 115, note: "total incl. bar" },
  single_leg_rdl: { name: "Single-Leg RDL",        bar: "dumbbell", inc: 5,   repMin: 8,  repMax: 12, sRepMin: 5, sRepMax: 8,  sets: 3, resetPct: 0.10,  stallN: 3, hW: 20,  sW: 30,  note: "per dumbbell" },
};

const WORKOUTS = {
  A: {
    label: "Workout A — Full Body (Squat)",
    defaultEmphasis: "hypertrophy",
    slots: [
      { primary: "belt_squat", alternates: ["lever_squat", "zercher_squat"] },
      { primary: "standing_press", alternates: ["seated_press"] },
      { primary: "tbar_row", alternates: ["db_row"] },
      { primary: "standing_ht", alternates: ["ht_machine", "rdl_barbell", "single_leg_rdl"] },
    ],
    get exercises() { return this.slots.map(s => s.primary); },
  },
  B: {
    label: "Workout B — Full Body (Hinge)",
    defaultEmphasis: "strength",
    slots: [
      { primary: "hex_deadlift", alternates: [] },
      { primary: "incline_smith", alternates: ["incline_db"] },
      { primary: "leg_press", alternates: ["hack_squat"] },
      { primary: "rdl_barbell", alternates: ["standing_ht", "ht_machine", "single_leg_rdl"] },
    ],
    get exercises() { return this.slots.map(s => s.primary); },
  },
};

const ALL_COMPOUND_IDS = Object.keys(EXERCISES);

const ACCESSORIES = [
  // Category-linked (referenced by A/B required categories — kept intact)
  { id: "lat_pulldown",  name: "Lat Pulldown",      muscle: "Back",       categories: ["vertical_pull"] },
  { id: "cable_row",     name: "Cable/Machine Row", muscle: "Back",       categories: ["upper_back_shoulder"] },
  { id: "face_pull",     name: "Face Pull",         muscle: "Shoulders",  categories: ["delt_upper_back", "upper_back_shoulder"] },
  { id: "bicep_curl",    name: "Bicep Curl",        muscle: "Biceps",     categories: ["arms"] },
  { id: "lateral_raise", name: "Lateral Raise",     muscle: "Shoulders",  categories: ["delt_upper_back", "upper_back_shoulder"] },
  { id: "rear_delt_fly", name: "Rear Delt Fly",     muscle: "Shoulders",  categories: ["delt_upper_back", "upper_back_shoulder"] },
  { id: "tricep_push",   name: "Tricep Pushdown",   muscle: "Triceps",    categories: ["arms"] },
  { id: "leg_curl",      name: "Hamstring Curl",    muscle: "Hamstrings", categories: ["hamstring_posterior"] },
  { id: "hip_thrust",    name: "Hip Thrust",        muscle: "Glutes",     categories: ["hamstring_posterior"] },
  { id: "rdl",           name: "Romanian Deadlift", muscle: "Hamstrings/Glutes", categories: ["hamstring_posterior"] },
  { id: "pull_up",       name: "Pull-Up",           muscle: "Lats",       categories: ["vertical_pull"] },
  // User's curated freeform movements
  { id: "db_row_acc",    name: "Dumbbell Row",      muscle: "Back",       categories: [] },
  { id: "goblet_squat",  name: "Goblet Squat",      muscle: "Quads",      categories: [] },
  { id: "hanging_leg_raise", name: "Hanging Leg Raise", muscle: "Abs",    categories: [] },
  { id: "sit_ups",       name: "Sit Ups",           muscle: "Abs",        categories: [] },
  { id: "push_ups",      name: "Push Ups",          muscle: "Chest",      categories: [] },
  { id: "seated_leg_ext", name: "Seated Leg Extension", muscle: "Quads",  categories: [] },
  { id: "neck",          name: "Neck Conditioning", muscle: "Neck",       categories: [] },
  { id: "bulgarian_split", name: "Bulgarian Split Squat", muscle: "Quads", categories: [] },
  { id: "db_rdl_acc",    name: "Dumbbell RDL",      muscle: "Hamstrings", categories: [] },
];

const REQUIRED_CATEGORIES = {
  A: [
    { id: "vertical_pull", label: "Vertical Pull", eligible: ["lat_pulldown"] },
    { id: "delt_upper_back", label: "Delt / Upper Back", eligible: ["face_pull", "rear_delt_fly"] },
  ],
  B: [
    { id: "upper_back_shoulder", label: "Upper Back / Shoulder", eligible: ["cable_row", "face_pull"] },
    { id: "arms", label: "Arms", eligible: ["bicep_curl", "tricep_push"] },
  ],
};

const ACC_TEMPLATES = {
  A: { label: "Workout A Favorites", ids: ["lat_pulldown", "face_pull", "leg_curl"] },
  B: { label: "Workout B Favorites", ids: ["leg_curl", "cable_row", "tricep_push"] },
  pull: { label: "Pull Day", ids: ["lat_pulldown", "cable_row", "bicep_curl", "face_pull"] },
  push: { label: "Push Extras", ids: ["lateral_raise", "tricep_push", "rear_delt_fly"] },
};

const BAR_WEIGHTS = { barbell: 45, smith: 25, hex: 55, none: 0, dumbbell: 0 };
const PLATES = [45, 35, 25, 10, 5, 2.5];
const TYPE_COLORS = { hypertrophy: "#93c5fd", strength: "#f97316" };

const STORAGE_KEYS = {
  history: "wt_h6",
  dup: "wt_d6",
  next: "wt_n6",
  bw: "wt_bw6",
  measurements: "wt_meas6",
  version: "wt_version",
  activeSession: "wt_active_session",
  accTemplates: "wt_acc_templates",
  settings: "wt_settings",
};

const MEASUREMENT_FIELDS = [
  { id: "chest", label: "Chest", unit: "in", hint: "Around the widest part, across the nipple line" },
  { id: "waist", label: "Waist", unit: "in", hint: "Around the navel, relaxed (don't suck in)" },
  { id: "arms", label: "Arms", unit: "in", hint: "Around the peak of the bicep, arm flexed" },
  { id: "legs", label: "Legs", unit: "in", hint: "Around the widest part of the quad, standing" },
];

const MEASUREMENT_PROMPT_DAYS = 28;

/* ═══════════════════════════════════════════
   UTILITY FUNCTIONS (pure, no React)
   ═══════════════════════════════════════════ */

function estimateE1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

function roundToIncrement(weight, inc) {
  return Math.round(weight / inc) * inc;
}

// Finding A: derive a dormant track's load-in weight from the active track.
// Returns { weight, derived, note } or null if not stale / can't derive.
// Stale = the target track hasn't been trained in 6+ same-lift sessions or 56+ days.
function deriveStaleWeight(exerciseId, targetTrack, dupState, history) {
  const config = EXERCISES[exerciseId];
  if (!config) return null;

  // Find the most recent completed session on EACH track for this lift.
  let lastTargetDate = null, lastActive = null;
  let targetSessionsSince = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const ex = (history[i].exercises || []).find(e => e.id === exerciseId);
    if (!ex) continue;
    const track = ex.sessionType === "strength" ? "strength" : "hypertrophy";
    const allDone = (ex.sets || []).length > 0 && ex.sets.every(st => st.completed);
    if (track === targetTrack) {
      if (!lastTargetDate) lastTargetDate = history[i].date;
    } else {
      targetSessionsSince++; // active-track sessions accumulating since target last ran
      if (allDone && !lastActive) lastActive = { weight: ex.weight, reps: parseFloat(ex.sets[ex.sets.length - 1].reps) || config.repMin };
    }
  }

  const daysSince = lastTargetDate ? daysSinceDate(lastTargetDate) : 9999;
  const isStale = (targetSessionsSince >= 6) || (daysSince >= 56) || !lastTargetDate;
  if (!isStale || !lastActive) return null;

  // Epley e1RM from the active track's last completed session, then solve for the
  // dormant track's rep target, apply a 0.92 haircut for untrained-range penalty.
  const e1rm = lastActive.weight * (1 + lastActive.reps / 30);
  const rTarget = targetTrack === "strength" ? config.sRepMax : config.repMax;
  const raw = (e1rm / (1 + rTarget / 30)) * 0.92;
  const derivedW = roundToIncrement(raw, config.inc);

  const stored = targetTrack === "strength" ? dupState.sW : dupState.hW;
  // Only override if derivation differs meaningfully from stored (avoid churn)
  if (Math.abs(derivedW - stored) < config.inc) return null;
  return { weight: derivedW, derived: true, note: `derived from ${targetTrack === "strength" ? "hyp" : "str"} track e1RM` };
}

function daysSinceDate(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
}

function isSunday() {
  return new Date().getDay() === 0;
}

function formatSeconds(totalSecs) {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function calculatePlates(totalWeight, barWeight) {
  const perSide = (totalWeight - barWeight) / 2;
  if (perSide <= 0) return [];
  let remaining = perSide;
  const result = [];
  for (const plate of PLATES) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      result.push({ plate, count });
      remaining = Math.round((remaining - count * plate) * 100) / 100;
    }
  }
  return result;
}

function getWeeklyStreak(history) {
  if (!history.length) return 0;
  let streak = 0;
  let weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  for (let week = 0; week < STREAK_LOOKBACK_WEEKS; week++) {
    const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);
    const sessionsThisWeek = history.filter(session => {
      const d = new Date(session.date);
      return d >= weekStart && d < weekEnd;
    }).length;
    if (sessionsThisWeek >= MIN_SESSIONS_PER_WEEK) streak++;
    else if (week > 0) break;
    weekStart = new Date(weekStart.getTime() - 7 * MS_PER_DAY);
  }
  return streak;
}

function initializeDUP() {
  const state = {};
  ALL_COMPOUND_IDS.forEach(id => {
    const config = EXERCISES[id];
    state[id] = { hW: config.hW, sW: config.sW, hStalls: 0, sStalls: 0, nextType: "hypertrophy" };
  });
  return state;
}

function applyDUPProgression(currentDup, completedExercises, history) {
  const updated = JSON.parse(JSON.stringify(currentDup));

  completedExercises.forEach(exercise => {
    const config = EXERCISES[exercise.id];
    if (!config) return;
    if (!updated[exercise.id]) {
      updated[exercise.id] = { hW: config.hW, sW: config.sW, hStalls: 0, sStalls: 0, nextType: "hypertrophy" };
    }

    const sessionType = exercise.sessionType;
    const isHyp = sessionType === "hypertrophy";
    // P1-1 FIX: success is hitting the BOTTOM of the rep range (repMin) on all sets,
    // not the top (repMax). Doing 10 clean reps when the range is 8-12 is a success.
    const successReps = isHyp ? config.repMin : config.sRepMin;
    const allSetsHitTarget = exercise.sets.every(set => set.completed && parseFloat(set.reps) >= successReps);
    const anySetsCompleted = exercise.sets.some(set => set.completed);

    if (!anySetsCompleted) return;

    const wKey = isHyp ? "hW" : "sW";
    const stallKey = isHyp ? "hStalls" : "sStalls";

    if (allSetsHitTarget) {
      updated[exercise.id][wKey] += config.inc;
      updated[exercise.id][stallKey] = 0;
      updated[exercise.id].lastDeload = null;
    } else {
      updated[exercise.id][stallKey]++;
      if (updated[exercise.id][stallKey] >= config.stallN) {
        const currentW = updated[exercise.id][wKey];
        // P1-2 FIX: cap deload at 10%, and never drop below the highest weight
        // successfully completed on this track in the trailing 4 same-track sessions.
        const capped = roundToIncrement(currentW * 0.9, config.inc);
        let floor = 0;
        if (history) {
          const sameTrack = history
            .flatMap(s => (s.exercises || []).filter(e => e.id === exercise.id && e.sessionType === sessionType))
            .filter(e => (e.sets || []).every(st => st.completed))
            .slice(-4);
          floor = sameTrack.reduce((mx, e) => Math.max(mx, e.weight || 0), 0);
        }
        const newW = Math.max(capped, floor || capped);
        if (newW < currentW) {
          updated[exercise.id][wKey] = newW;
          updated[exercise.id].lastDeload = { track: sessionType, from: currentW, to: newW, reason: `${config.stallN} stalls`, date: new Date().toISOString() };
        }
        updated[exercise.id][stallKey] = 0;
      }
    }
    updated[exercise.id].nextType = isHyp ? "strength" : "hypertrophy";
  });
  return updated;
}

function getPersonalRecords(history) {
  const records = {};
  ALL_COMPOUND_IDS.forEach(id => { records[id] = { weight: 0, e1rm: 0 }; });

  history.forEach(session => {
    session.exercises?.forEach(exercise => {
      if (!records[exercise.id]) return;
      if (exercise.weight > records[exercise.id].weight) records[exercise.id].weight = exercise.weight;
      exercise.sets?.filter(set => set.completed && parseFloat(set.reps) > 0).forEach(set => {
        const estimated = estimateE1RM(exercise.weight, parseFloat(set.reps));
        if (estimated > records[exercise.id].e1rm) records[exercise.id].e1rm = estimated;
      });
    });
  });
  return records;
}

function getAccessoryLastDone(history) {
  const lastDone = {};
  ACCESSORIES.forEach(acc => { lastDone[acc.id] = null; });
  history.forEach(session => {
    session.accessories?.forEach(acc => { lastDone[acc.id] = session.date; });
  });
  return lastDone;
}

// P1-3: last logged sets/reps/weight per accessory, for prefilling the next session
function getAccessoryLastValues(history) {
  const last = {};
  history.forEach(session => {
    session.accessories?.forEach(acc => {
      last[acc.id] = { sets: acc.sets, reps: acc.reps, weight: acc.weight };
    });
  });
  return last;
}

function getSuggestedAccessories(history) {
  const lastDone = getAccessoryLastDone(history);
  return [...ACCESSORIES]
    .sort((a, b) => {
      const timeA = lastDone[a.id] ? new Date(lastDone[a.id]).getTime() : 0;
      const timeB = lastDone[b.id] ? new Date(lastDone[b.id]).getTime() : 0;
      return timeA - timeB;
    })
    .slice(0, 2)
    .map(acc => acc.id);
}

function getDurationStats(history, workoutKey) {
  const durations = history
    .filter(session => session.workout === workoutKey && session.duration > 0)
    .map(session => cleanDuration(session.duration))
    .filter(d => d != null);
  if (!durations.length) return null;
  return {
    last: durations[durations.length - 1],
    avg: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
    fastest: Math.min(...durations),
    longest: Math.max(...durations),
    count: durations.length,
  };
}

function getSessionVolume(session) {
  let total = 0;
  // Compound exercise volume
  if (session?.exercises) {
    total += session.exercises.reduce((sum, exercise) => {
      const setVolume = exercise.sets
        ?.filter(set => set.completed && parseFloat(set.reps) > 0)
        .reduce((s, set) => s + exercise.weight * parseFloat(set.reps), 0) || 0;
      return sum + setVolume;
    }, 0);
  }
  // Accessory volume (only counts entries with a logged weight)
  if (session?.accessories) {
    total += session.accessories.reduce((sum, acc) => {
      if (!acc.done) return sum;
      const w = parseFloat(acc.weight);
      const reps = parseFloat(acc.reps);
      const sets = parseFloat(acc.sets);
      if (w > 0 && reps > 0 && sets > 0) return sum + w * reps * sets;
      return sum;
    }, 0);
  }
  return total;
}

// P3-b: muscle contribution maps (primary 1.0, secondary fractional). Practical, not exact.
const MUSCLE_MAP = {
  belt_squat: { Quads: 1.0, Glutes: 0.5 }, lever_squat: { Quads: 1.0, Glutes: 0.5 },
  zercher_squat: { Quads: 1.0, Glutes: 0.5, Back: 0.25 },
  standing_press: { Shoulders: 1.0, Triceps: 0.5 }, seated_press: { Shoulders: 1.0, Triceps: 0.5 },
  tbar_row: { Back: 1.0, Lats: 0.5, Biceps: 0.25 }, db_row: { Back: 1.0, Lats: 0.5, Biceps: 0.25 },
  hex_deadlift: { Glutes: 1.0, Hamstrings: 0.75, Quads: 0.5, Back: 0.25 },
  incline_smith: { Chest: 1.0, Shoulders: 0.5, Triceps: 0.5 }, incline_db: { Chest: 1.0, Shoulders: 0.5, Triceps: 0.5 },
  leg_press: { Quads: 1.0, Glutes: 0.5 }, hack_squat: { Quads: 1.0, Glutes: 0.5 },
  standing_ht: { Glutes: 1.0, Hamstrings: 0.5 }, ht_machine: { Glutes: 1.0, Hamstrings: 0.5 },
  rdl_barbell: { Hamstrings: 1.0, Glutes: 0.75 }, single_leg_rdl: { Hamstrings: 1.0, Glutes: 0.75 },
  lat_pulldown: { Lats: 1.0, Biceps: 0.5 }, pull_up: { Lats: 1.0, Biceps: 0.5 },
  cable_row: { Back: 1.0, Lats: 0.5, Biceps: 0.25 }, face_pull: { RearDelts: 1.0, Shoulders: 0.5 },
  rear_delt_fly: { RearDelts: 1.0 }, lateral_raise: { Shoulders: 1.0 },
  bicep_curl: { Biceps: 1.0 }, tricep_push: { Triceps: 1.0 },
  leg_curl: { Hamstrings: 1.0 }, hip_thrust: { Glutes: 1.0, Hamstrings: 0.5 }, rdl: { Hamstrings: 1.0, Glutes: 0.75 },
  shrug: { Traps: 1.0 }, db_fly: { Chest: 1.0 },
  dec_crunch: { Abs: 1.0 }, dead_bug: { Abs: 1.0 }, ab_wheel: { Abs: 1.0 }, pallof_press: { Abs: 1.0 },
  db_row_acc: { Back: 1.0, Lats: 0.5, Biceps: 0.25 }, goblet_squat: { Quads: 1.0, Glutes: 0.5 },
  hanging_leg_raise: { Abs: 1.0 }, sit_ups: { Abs: 1.0 }, push_ups: { Chest: 1.0, Triceps: 0.5, Shoulders: 0.25 },
  seated_leg_ext: { Quads: 1.0 }, neck: { Neck: 1.0 }, bulgarian_split: { Quads: 1.0, Glutes: 0.5 },
  db_rdl_acc: { Hamstrings: 1.0, Glutes: 0.75 },
};

const MUSCLE_TARGETS = {
  Quads: [8, 12], Hamstrings: [8, 12], Glutes: [8, 12], Chest: [8, 12], Back: [8, 14],
  Lats: [8, 12], Shoulders: [8, 14], RearDelts: [4, 8], Biceps: [4, 8], Triceps: [4, 8], Abs: [4, 8], Traps: [4, 8], Neck: [2, 6],
};

// Finding E: analytics-layer cleaning. Raw records are preserved in storage;
// these filters run only when computing charts/trends/summaries.
function cleanBwHistory(bw) {
  return (bw || []).filter(e => e.weight >= 50 && e.weight <= 500);
}
function cleanDuration(mins) {
  return mins > 180 ? null : mins; // exclude garbage durations from stats
}
function cleanMeasurements(m) {
  // Collapse exact-duplicate rows (all four values identical to an earlier kept row) to first occurrence.
  const out = [];
  (m || []).forEach(e => {
    const dup = out.some(k => k.chest === e.chest && k.waist === e.waist && k.arms === e.arms && k.legs === e.legs);
    if (!dup) out.push(e);
  });
  return out;
}
// Ghost sessions: compound session with zero completed sets. Excluded from analytics.
function isGhostSession(session) {
  if (session.workout === "ACC") return false; // accessory sessions legitimately have no compound sets
  const anyCompleted = (session.exercises || []).some(ex => (ex.sets || []).some(st => st.completed));
  return !anyCompleted;
}
function cleanSessions(history) {
  return (history || []).filter(s => !isGhostSession(s));
}

function getWeeklyMuscleSets(history) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const sets = {};
  Object.keys(MUSCLE_TARGETS).forEach(m => { sets[m] = 0; });
  history.forEach(session => {
    if (new Date(session.date) < weekAgo) return;
    (session.exercises || []).forEach(ex => {
      const map = MUSCLE_MAP[ex.id]; if (!map) return;
      const done = (ex.sets || []).filter(s => s.completed).length;
      Object.entries(map).forEach(([m, f]) => { if (sets[m] != null) sets[m] += done * f; });
    });
    (session.accessories || []).forEach(acc => {
      if (!acc.done) return;
      const map = MUSCLE_MAP[acc.id]; if (!map) return;
      const n = parseFloat(acc.sets) || 0;
      Object.entries(map).forEach(([m, f]) => { if (sets[m] != null) sets[m] += n * f; });
    });
  });
  return sets;
}

// P3-d: lifts whose current working weight is below their trailing 8-week max on the same track
function getRegressions(history, dup) {
  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 56 * MS_PER_DAY);
  const maxByTrack = {};
  const countByTrack = {};
  history.forEach(session => {
    if (new Date(session.date) < eightWeeksAgo) return;
    (session.exercises || []).forEach(ex => {
      const key = ex.id + "_" + (ex.sessionType === "strength" ? "s" : "h");
      const allDone = (ex.sets || []).length > 0 && (ex.sets || []).every(s => s.completed);
      if (allDone) {
        maxByTrack[key] = Math.max(maxByTrack[key] || 0, ex.weight || 0);
        countByTrack[key] = (countByTrack[key] || 0) + 1;
      }
    });
  });
  const flags = [];
  Object.keys(dup || {}).forEach(id => {
    const config = EXERCISES[id]; if (!config) return;
    const hKey = id + "_h", sKey = id + "_s";
    const hMax = maxByTrack[hKey]; const sMax = maxByTrack[sKey];
    // Finding A: suppress the flag for tracks with <2 recent completed sessions (freshly derived)
    if (hMax && (countByTrack[hKey] || 0) >= 2 && dup[id].hW < hMax) flags.push({ id, name: config.name, track: "hyp", now: dup[id].hW, peak: hMax });
    if (sMax && (countByTrack[sKey] || 0) >= 2 && dup[id].sW < sMax) flags.push({ id, name: config.name, track: "str", now: dup[id].sW, peak: sMax });
  });
  return flags;
}

function getWeeklyVolume(history) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);

  const thisWeek = history.filter(session => {
    const d = new Date(session.date);
    return d >= weekStart && d < weekEnd;
  });

  const lastWeekStart = new Date(weekStart.getTime() - 7 * MS_PER_DAY);
  const lastWeek = history.filter(session => {
    const d = new Date(session.date);
    return d >= lastWeekStart && d < weekStart;
  });

  const thisTotal = thisWeek.reduce((sum, session) => sum + getSessionVolume(session), 0);
  const lastTotal = lastWeek.reduce((sum, session) => sum + getSessionVolume(session), 0);
  const change = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : null;

  return { thisWeek: thisTotal, lastWeek: lastTotal, change, sessionCount: thisWeek.length };
}

function getVolumeHistory(history) {
  return history.map(session => ({
    date: new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    volume: Math.round(getSessionVolume(session)),
    workout: session.workout,
  }));
}

function getCalendarData(history) {
  const map = {};
  history.forEach(session => {
    const dateKey = new Date(session.date).toISOString().split("T")[0];
    map[dateKey] = { workout: session.workout, rpe: session.rpe, isDeload: session.isDeload };
  });
  return map;
}

function getRequiredCategories(workoutKey) {
  return REQUIRED_CATEGORIES[workoutKey] || [];
}

function checkCategoryCompletion(categories, accItems) {
  return categories.map(cat => {
    const completed = accItems.some(acc => (acc.done || acc.sets) && cat.eligible.includes(acc.id));
    const matchedAcc = accItems.find(acc => cat.eligible.includes(acc.id));
    return { ...cat, completed, matchedAccName: matchedAcc?.name || null };
  });
}

/* ═══════════════════════════════════════════
   SEED DATA (first-launch only)
   ═══════════════════════════════════════════ */

const SEED_HISTORY = [
  {
    workout: "A",
    label: "Workout A — Full Body (Squat)",
    date: "2026-04-14T10:00:00.000Z",
    emphasis: "hypertrophy",
    rpe: 7,
    note: "",
    duration: 0,
    accessories: [
      { id: "dec_crunch", name: "Decline Crunch", sets: "3", reps: "10", weight: "", done: true },
      { id: "face_pull", name: "Face Pull", sets: "3", reps: "10", weight: "", done: true },
    ],
    exercises: [
      {
        id: "belt_squat", name: "Belt Squat", weight: 180,
        targetReps: 10, repMin: 8, sessionType: "hypertrophy", rest: 90,
        sets: [{ reps: "10", completed: true }, { reps: "10", completed: true }, { reps: "10", completed: true }],
      },
      {
        id: "standing_press", name: "Barbell Standing Press", weight: 95,
        targetReps: 10, repMin: 6, sessionType: "hypertrophy", rest: 90,
        sets: [{ reps: "8", completed: true }, { reps: "8", completed: true }, { reps: "8", completed: true }],
      },
      {
        id: "tbar_row", name: "Lying T-Bar Row", weight: 70,
        targetReps: 12, repMin: 8, sessionType: "hypertrophy", rest: 90,
        sets: [{ reps: "10", completed: true }, { reps: "10", completed: true }, { reps: "10", completed: true }],
      },
    ],
  },
  {
    workout: "B",
    label: "Workout B — Full Body (Hinge)",
    date: "2026-04-15T10:00:00.000Z",
    emphasis: "strength",
    rpe: 7,
    note: "",
    duration: 0,
    accessories: [
      { id: "shrug", name: "Shrug", sets: "3", reps: "10", weight: "", done: true },
      { id: "bicep_curl", name: "Bicep Curl", sets: "3", reps: "10", weight: "", done: true },
    ],
    exercises: [
      {
        id: "hex_deadlift", name: "Hex Bar Deadlift", weight: 160,
        targetReps: 5, repMin: 3, sessionType: "strength", rest: 180,
        sets: [{ reps: "5", completed: true }, { reps: "5", completed: true }, { reps: "5", completed: true }],
      },
      {
        id: "incline_smith", name: "Incline Smith Press", weight: 125,
        targetReps: 8, repMin: 5, sessionType: "strength", rest: 180,
        sets: [{ reps: "8", completed: true }, { reps: "8", completed: true }, { reps: "8", completed: true }],
      },
      {
        id: "leg_press", name: "Leg Press", weight: 230,
        targetReps: 10, repMin: 6, sessionType: "strength", rest: 180,
        sets: [{ reps: "10", completed: true }, { reps: "10", completed: true }, { reps: "10", completed: true }],
      },
    ],
  },
];

// DUP state AFTER these two sessions are applied
// Session A (hyp): belt_squat 180 hit 10 all sets → hW 180+5=185; press got 8 not 10 → hStalls=1; tbar got 10 not 12 → hStalls=1
// Session B (str): hex_deadlift hit 5 all sets → sW 160+5=165; incline hit 8>=8 → sW 125+5=130; leg_press hit 10 all sets → sW 230+5=235
const SEED_DUP = {
  belt_squat:     { hW: 185, sW: 200, hStalls: 0, sStalls: 0, nextType: "strength" },
  lever_squat:    { hW: 130, sW: 130, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  zercher_squat:  { hW: 95,  sW: 115, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  standing_press: { hW: 95,  sW: 110, hStalls: 1, sStalls: 0, nextType: "strength" },
  seated_press:   { hW: 120, sW: 120, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  tbar_row:       { hW: 70,  sW: 80,  hStalls: 1, sStalls: 0, nextType: "strength" },
  db_row:         { hW: 70,  sW: 85,  hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  hex_deadlift:   { hW: 165, sW: 165, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  incline_smith:  { hW: 90,  sW: 130, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  incline_db:     { hW: 50,  sW: 65,  hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  leg_press:      { hW: 225, sW: 235, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  hack_squat:     { hW: 180, sW: 200, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  standing_ht:    { hW: 110, sW: 120, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  ht_machine:     { hW: 110, sW: 120, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  rdl_barbell:    { hW: 95,  sW: 115, hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
  single_leg_rdl: { hW: 20,  sW: 30,  hStalls: 0, sStalls: 0, nextType: "hypertrophy" },
};

const SEED_NEXT_WORKOUT = "A";

/* ═══════════════════════════════════════════
   STORAGE HELPERS (localStorage)
   ═══════════════════════════════════════════ */

function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Storage write failed:", key, err);
  }
}

function storageSetRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error("Storage write failed:", key, err);
  }
}

function storageDelete(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function migrateIfNeeded() {
  const version = localStorage.getItem(STORAGE_KEYS.version);
  const versionNum = version ? parseInt(version, 10) : null;

  if (versionNum === STORAGE_VERSION) return null;

  const oldHistKeys = ["wt_h5", "wt_history_v4", "workout_history"];
  const oldDupKeys = ["wt_d5", "wt_dup_v4"];
  const oldNextKeys = ["wt_n5", "wt_next_v4", "next_workout"];
  const oldBwKeys = ["wt_bw5", "wt_bw_v4", "bw_history"];

  let history = null, dupData = null, nextWorkout = null, bwData = null;

  for (const key of oldHistKeys) {
    const val = storageGet(key);
    if (Array.isArray(val) && val.length > 0) { history = val; break; }
  }
  for (const key of oldDupKeys) {
    const val = storageGet(key);
    if (val && typeof val === "object") { dupData = val; break; }
  }
  for (const key of oldNextKeys) {
    const raw = localStorage.getItem(key);
    if (raw) { nextWorkout = raw; break; }
  }
  for (const key of oldBwKeys) {
    const val = storageGet(key);
    if (Array.isArray(val) && val.length > 0) { bwData = val; break; }
  }

  return { history, dupData, nextWorkout, bwData };
}

/* ═══════════════════════════════════════════
   CUSTOM HOOK: useWorkoutStorage
   ═══════════════════════════════════════════ */

function useWorkoutStorage() {
  const [history, setHistory] = useState([]);
  const [dup, setDup] = useState(initializeDUP());
  const [bwHistory, setBwHistory] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [nextWorkout, setNextWorkout] = useState("A");
  const [settings, setSettings] = useState({ autoRestTimer: true });
  const [customTemplates, setCustomTemplates] = useState(ACC_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [recoveredSession, setRecoveredSession] = useState(null);

  useEffect(() => {
    try {
      // If there is no real history in storage yet (fresh browser, cleared data,
      // or a URL that never had data), seed from the user's baked-in export.
      const existingHist = storageGet(STORAGE_KEYS.history);
      const hasRealData = Array.isArray(existingHist) && existingHist.length > 0;

      if (!hasRealData) {
        const mergedDup = { ...initializeDUP(), ...USER_SEED.dup };
        setHistory(USER_SEED.history);
        storageSet(STORAGE_KEYS.history, USER_SEED.history);
        setDup(mergedDup);
        storageSet(STORAGE_KEYS.dup, mergedDup);
        setNextWorkout(USER_SEED.next);
        storageSetRaw(STORAGE_KEYS.next, USER_SEED.next);
        setBwHistory(USER_SEED.bw);
        storageSet(STORAGE_KEYS.bw, USER_SEED.bw);
        setMeasurements(USER_SEED.measurements);
        storageSet(STORAGE_KEYS.measurements, USER_SEED.measurements);
        storageSetRaw(STORAGE_KEYS.version, String(STORAGE_VERSION));

        const savedSettings = storageGet(STORAGE_KEYS.settings);
        if (savedSettings) setSettings(prev => ({ ...prev, ...savedSettings }));
        const savedTemplates = storageGet(STORAGE_KEYS.accTemplates);
        if (savedTemplates) setCustomTemplates(prev => ({ ...prev, ...savedTemplates }));
        setLoading(false);
        return;
      }

      const migrated = migrateIfNeeded();

      if (migrated) {
        if (migrated.history) { setHistory(migrated.history); storageSet(STORAGE_KEYS.history, migrated.history); }
        if (migrated.dupData) { setDup(migrated.dupData); storageSet(STORAGE_KEYS.dup, migrated.dupData); }
        if (migrated.nextWorkout) { setNextWorkout(migrated.nextWorkout); storageSetRaw(STORAGE_KEYS.next, migrated.nextWorkout); }
        if (migrated.bwData) { setBwHistory(migrated.bwData); storageSet(STORAGE_KEYS.bw, migrated.bwData); }
        storageSetRaw(STORAGE_KEYS.version, String(STORAGE_VERSION));
      } else {
        const hist = storageGet(STORAGE_KEYS.history);
        if (Array.isArray(hist) && hist.length > 0) {
          setHistory(hist);

          const dupData = storageGet(STORAGE_KEYS.dup);
          if (dupData && typeof dupData === "object") setDup(dupData);

          const nextRaw = localStorage.getItem(STORAGE_KEYS.next);
          if (nextRaw) setNextWorkout(nextRaw);

          const bwData = storageGet(STORAGE_KEYS.bw);
          if (Array.isArray(bwData) && bwData.length > 0) setBwHistory(bwData);

          const measData = storageGet(STORAGE_KEYS.measurements);
          if (Array.isArray(measData) && measData.length > 0) setMeasurements(measData);
        } else {
          // First launch: inject user's real exported data as seed
          setHistory(USER_SEED.history);
          storageSet(STORAGE_KEYS.history, USER_SEED.history);
          // Merge user's saved weights over full defaults so new exercises (glute compounds, substitutes) have valid state
          const mergedDup = { ...initializeDUP(), ...USER_SEED.dup };
          setDup(mergedDup);
          storageSet(STORAGE_KEYS.dup, mergedDup);
          setNextWorkout(USER_SEED.next);
          storageSetRaw(STORAGE_KEYS.next, USER_SEED.next);
          setBwHistory(USER_SEED.bw);
          storageSet(STORAGE_KEYS.bw, USER_SEED.bw);
          setMeasurements(USER_SEED.measurements);
          storageSet(STORAGE_KEYS.measurements, USER_SEED.measurements);
          storageSetRaw(STORAGE_KEYS.version, String(STORAGE_VERSION));
        }
      }

      const savedSettings = storageGet(STORAGE_KEYS.settings);
      if (savedSettings) setSettings(prev => ({ ...prev, ...savedSettings }));

      // One-time correction of weights corrupted by the pre-fix persistence bug.
      // tbar_row real working weight is 90 (2x45 plates); standing_ht is 140.
      if (!localStorage.getItem("wt_wfix1")) {
        const dupNow = storageGet(STORAGE_KEYS.dup);
        if (dupNow && typeof dupNow === "object") {
          if (dupNow.tbar_row && dupNow.tbar_row.hW < 90) dupNow.tbar_row.hW = 90;
          if (dupNow.standing_ht && dupNow.standing_ht.hW < 140) dupNow.standing_ht.hW = 140;
          storageSet(STORAGE_KEYS.dup, dupNow);
          setDup(dupNow);
        }
        localStorage.setItem("wt_wfix1", "1");
      }

      const savedTemplates = storageGet(STORAGE_KEYS.accTemplates);
      if (savedTemplates) setCustomTemplates(prev => ({ ...prev, ...savedTemplates }));

      const activeSession = storageGet(STORAGE_KEYS.activeSession);
      if (activeSession && activeSession.session) {
        setRecoveredSession(activeSession);
      }
    } catch (err) {
      console.error("Load failed:", err);
    }
    setLoading(false);
  }, []);

  const saveHistory = useCallback((newHistory) => {
    setHistory(newHistory);
    storageSet(STORAGE_KEYS.history, newHistory);
  }, []);

  const saveDup = useCallback((newDup) => {
    setDup(newDup);
    storageSet(STORAGE_KEYS.dup, newDup);
  }, []);

  const saveNextWorkout = useCallback((key) => {
    setNextWorkout(key);
    storageSetRaw(STORAGE_KEYS.next, key);
  }, []);

  const saveBW = useCallback((weight) => {
    const w = parseFloat(weight);
    // P2-1: range validation
    if (!(w >= 50 && w <= 500)) {
      return { ok: false, error: `That looks out of range (50-500 lb expected).` };
    }
    const now = Date.now();
    let updated = [...bwHistory];
    // P2-1: if the last entry is within 5 minutes, replace it (dedupe rapid corrections)
    const last = updated[updated.length - 1];
    if (last && (now - new Date(last.date).getTime()) < 5 * 60 * 1000) {
      updated[updated.length - 1] = { date: new Date().toISOString(), weight: w };
    } else {
      updated.push({ date: new Date().toISOString(), weight: w });
    }
    setBwHistory(updated);
    storageSet(STORAGE_KEYS.bw, updated);
    return { ok: true };
  }, [bwHistory]);

  const saveActiveSession = useCallback((sessionData) => {
    storageSet(STORAGE_KEYS.activeSession, sessionData);
  }, []);

  const clearActiveSession = useCallback(() => {
    storageDelete(STORAGE_KEYS.activeSession);
  }, []);

  const updateHistorySession = useCallback((index, updatedSession) => {
    const newHistory = [...history];
    newHistory[index] = updatedSession;
    setHistory(newHistory);
    storageSet(STORAGE_KEYS.history, newHistory);
  }, [history]);

  const deleteHistorySession = useCallback((index) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    storageSet(STORAGE_KEYS.history, newHistory);
  }, [history]);

  const saveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    storageSet(STORAGE_KEYS.settings, newSettings);
  }, []);

  const saveCustomTemplates = useCallback((templates) => {
    setCustomTemplates(templates);
    storageSet(STORAGE_KEYS.accTemplates, templates);
  }, []);

  const saveMeasurements = useCallback((entry) => {
    const now = Date.now();
    let updated = [...measurements];
    const last = updated[updated.length - 1];
    // P2-3: dedupe rapid same-entry saves within 5 minutes. Exact-duplicate rows are
    // also collapsed at the analytics layer, so no blocking confirm is needed here.
    if (last && (now - new Date(last.date).getTime()) < 5 * 60 * 1000) {
      updated[updated.length - 1] = { ...entry, date: new Date().toISOString() };
    } else {
      updated.push({ ...entry, date: new Date().toISOString() });
    }
    setMeasurements(updated);
    storageSet(STORAGE_KEYS.measurements, updated);
  }, [measurements]);

  return {
    history, dup, bwHistory, measurements, nextWorkout, settings, customTemplates, loading, recoveredSession,
    saveHistory, saveDup, saveNextWorkout, saveBW, saveMeasurements, saveActiveSession, clearActiveSession,
    updateHistorySession, deleteHistorySession, saveSettings, saveCustomTemplates, setRecoveredSession,
  };
}

/* ═══════════════════════════════════════════
   COMPONENTS: Modals & Overlays
   ═══════════════════════════════════════════ */

function RestTimer({ defaultSecs, onClose }) {
  const endTimeRef = useRef(Date.now() + defaultSecs * 1000);
  const [remaining, setRemaining] = useState(defaultSecs);
  const [paused, setPaused] = useState(false);
  const [pausedRemaining, setPausedRemaining] = useState(null);
  const rafRef = useRef();

  useEffect(() => {
    if (paused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    function tick() {
      const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  function togglePause() {
    if (paused) {
      // Resume: set new end time based on what was remaining
      endTimeRef.current = Date.now() + (pausedRemaining ?? remaining) * 1000;
      setPaused(false);
    } else {
      setPausedRemaining(remaining);
      setPaused(true);
    }
  }

  function reset() {
    endTimeRef.current = Date.now() + defaultSecs * 1000;
    setRemaining(defaultSecs);
    setPaused(false);
    setPausedRemaining(null);
  }

  const progressPct = ((defaultSecs - remaining) / defaultSecs) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const done = remaining === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
      <div className="max-w-md mx-auto bg-gray-900 border border-gray-700 rounded-2xl shadow-lg overflow-hidden">
        {/* progress bar */}
        <div className="h-1 bg-gray-800">
          <div className="h-full transition-all duration-300"
            style={{ width: `${progressPct}%`, backgroundColor: done ? "#22c55e" : "#1e3a5f" }} />
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-500">Rest</span>
            <span className={`text-xl font-bold tabular-nums ${done ? "text-green-400" : "text-white"}`}>
              {done ? "Done!" : `${mins}:${secs.toString().padStart(2, "0")}`}
            </span>
          </div>
          <button onClick={togglePause} className="text-xs bg-gray-700 px-3 py-1.5 rounded-lg font-semibold text-gray-200">
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={reset} className="text-xs bg-gray-700 px-3 py-1.5 rounded-lg font-semibold text-gray-200">Reset</button>
          <button onClick={onClose} className="text-xs bg-navy text-navy-light px-3 py-1.5 rounded-lg font-semibold">✕</button>
        </div>
      </div>
    </div>
  );
}

function PlateCalculator({ exercises, onClose }) {
  const [selectedId, setSelectedId] = useState(exercises[0]?.id || "");
  const [customWeight, setCustomWeight] = useState("");

  const exercise = exercises.find(ex => ex.id === selectedId);
  const config = exercise ? EXERCISES[exercise.id] : null;
  const barWeight = config ? (BAR_WEIGHTS[config.bar] || 0) : 0;
  const targetWeight = customWeight !== "" ? (parseFloat(customWeight) || 0) : (exercise?.weight || 0);
  const plates = config ? calculatePlates(targetWeight, barWeight) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div className="font-bold text-lg">Plate Calculator</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-10 h-10 flex items-center justify-center">✕</button>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Exercise</div>
            <select value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setCustomWeight(""); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
              {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Target (lb)</div>
            <input type="number" inputMode="decimal"
              value={customWeight !== "" ? customWeight : targetWeight}
              onChange={e => setCustomWeight(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-navy" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-3">Bar: {barWeight}lb · Each side:</div>
          {plates.length === 0
            ? <div className="text-gray-500 text-sm">Bar only</div>
            : <div className="flex flex-wrap gap-2">
                {plates.map(({ plate, count }) => (
                  <div key={plate} className="bg-gray-700 rounded-lg px-3 py-2 text-center">
                    <div className="text-white font-bold text-sm">{plate}lb</div>
                    <div className="text-gray-400 text-xs">×{count}</div>
                  </div>
                ))}
              </div>
          }
          <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
            Total: <span className="text-white font-semibold">
              {barWeight + plates.reduce((sum, { plate, count }) => sum + plate * count * 2, 0)}lb
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BodyweightModal({ onSave, onClose, lastWeight }) {
  const [value, setValue] = useState(lastWeight || "");
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-gray-700 text-center">
        <div className="text-3xl mb-2">⚖</div>
        <div className="font-bold text-lg mb-1">Sunday Check-in</div>
        <div className="text-gray-400 text-sm mb-4">Log your bodyweight</div>
        <input type="number" inputMode="decimal" placeholder="e.g. 162.0"
          value={value} onChange={e => { setValue(e.target.value); setError(""); }}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-center text-xl font-bold text-white outline-none focus:border-navy mb-2" />
        <div className="text-xs text-gray-500 mb-2">lb</div>
        {error && <div className="text-xs text-red-400 mb-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Skip</button>
          <button onClick={() => {
            if (!value) return;
            const res = onSave(parseFloat(value));
            if (res && !res.ok) setError(res.error);
          }}
            className="flex-1 bg-navy text-navy-light py-3 rounded-xl text-sm font-semibold">Save</button>
        </div>
      </div>
    </div>
  );
}

function MeasurementsModal({ onSave, onClose, lastEntry }) {
  // P2-3: do NOT prefill with last values (that produced fake "unchanged" entries).
  // Fields start empty; last value shows only as a grey placeholder hint.
  const [values, setValues] = useState(() => {
    const init = {};
    MEASUREMENT_FIELDS.forEach(f => { init[f.id] = ""; });
    return init;
  });
  const hasAny = Object.values(values).some(v => v !== "");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-gray-700">
        <div className="text-3xl mb-2 text-center">📐</div>
        <div className="font-bold text-lg mb-1 text-center">Body Measurements</div>
        <div className="text-gray-400 text-sm mb-4 text-center">Log in inches. Skip any field.</div>
        <div className="space-y-4 mb-4">
          {MEASUREMENT_FIELDS.map(field => (
            <div key={field.id}>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-14">{field.label}</span>
                <input type="number" inputMode="decimal" placeholder={lastEntry?.[field.id] ? String(lastEntry[field.id]) : "—"}
                  value={values[field.id]}
                  onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-center text-sm font-bold text-white outline-none focus:border-navy" />
                <span className="text-xs text-gray-500 w-6">{field.unit}</span>
              </div>
              <div className="text-xs text-gray-600 italic ml-16 mt-1">{field.hint}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Cancel</button>
          <button onClick={() => {
            if (!hasAny) return;
            const entry = { date: new Date().toISOString() };
            // For fields the user filled, use the new value. For blank fields, carry
            // forward the last known value so the record stays complete (but this only
            // happens when at least one field was actually changed).
            MEASUREMENT_FIELDS.forEach(f => {
              if (values[f.id]) entry[f.id] = parseFloat(values[f.id]);
              else if (lastEntry?.[f.id] != null) entry[f.id] = lastEntry[f.id];
            });
            onSave(entry);
          }} disabled={!hasAny}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold ${hasAny ? "bg-navy text-navy-light" : "bg-gray-700 opacity-50"}`}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = "Confirm", danger = false }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-gray-700 text-center space-y-4">
        <div className="font-bold text-lg">{title}</div>
        <div className="text-sm text-gray-400">{message}</div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Cancel</button>
          <button onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold ${danger ? "bg-red-600" : "bg-navy text-navy-light"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Styled replacement for native alert() — single dismiss button.
function AlertDialog({ title, message, onClose, closeLabel = "OK" }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-gray-700 text-center space-y-4">
        {title && <div className="font-bold text-lg">{title}</div>}
        <div className="text-sm text-gray-400">{message}</div>
        <button onClick={onClose} className="w-full bg-navy text-navy-light py-3 rounded-xl text-sm font-semibold">{closeLabel}</button>
      </div>
    </div>
  );
}

function RecoveryDialog({ sessionData, onRecover, onDiscard }) {
  const elapsed = sessionData?.elapsed || 0;
  const workoutLabel = sessionData?.session?.label || "Unknown";
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-navy text-center space-y-4">
        <div className="text-3xl">💪</div>
        <div className="font-bold text-lg">Session Recovered</div>
        <div className="text-sm text-gray-400">
          Found an unfinished <span className="text-white">{workoutLabel}</span> session ({formatSeconds(elapsed)} elapsed).
        </div>
        <div className="flex gap-3">
          <button onClick={onDiscard} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Discard</button>
          <button onClick={onRecover} className="flex-1 bg-navy text-navy-light py-3 rounded-xl text-sm font-semibold">Resume</button>
        </div>
      </div>
    </div>
  );
}

function AccessoryPicker({ accItems, lastDone, onAdd, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-end justify-center z-50">
      <div className="bg-gray-900 rounded-t-3xl p-6 w-full max-w-lg border-t border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div className="font-bold">Add Accessory</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-10 h-10 flex items-center justify-center">✕</button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {ACCESSORIES.map(acc => {
            const lastDate = lastDone[acc.id];
            const alreadyAdded = accItems.find(item => item.id === acc.id);
            return (
              <button key={acc.id} onClick={() => onAdd(acc.id)} disabled={!!alreadyAdded}
                className={`w-full flex justify-between items-center px-4 py-3 rounded-xl text-sm transition-colors ${
                  alreadyAdded ? "opacity-40 bg-gray-800" : "bg-gray-800 hover:bg-gray-700"
                }`}>
                <div>
                  <span className="text-white">{acc.name}</span>
                  <span className="text-gray-500 ml-2 text-xs">{acc.muscle}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {lastDate ? daysSinceDate(lastDate) + "d ago" : "never"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccessoryTemplatePicker({ templates, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-end justify-center z-50">
      <div className="bg-gray-900 rounded-t-3xl p-6 w-full max-w-lg border-t border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div className="font-bold">Load Template</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-10 h-10 flex items-center justify-center">✕</button>
        </div>
        <div className="space-y-2">
          {Object.entries(templates).map(([key, tmpl]) => (
            <button key={key} onClick={() => onSelect(tmpl.ids)}
              className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 text-left transition-colors">
              <div className="text-sm text-white font-medium">{tmpl.label}</div>
              <div className="text-xs text-gray-500 mt-1">
                {tmpl.ids.map(id => ACCESSORIES.find(a => a.id === id)?.name).filter(Boolean).join(", ")}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionEditor({ session, index, onSave, onDelete, onClose }) {
  const [edited, setEdited] = useState(JSON.parse(JSON.stringify(session)));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function updateExerciseSet(exIdx, setIdx, field, value) {
    setEdited(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.exercises[exIdx].sets[setIdx][field] = value;
      return copy;
    });
  }

  function updateExerciseWeight(exIdx, newWeight) {
    setEdited(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.exercises[exIdx].weight = newWeight;
      return copy;
    });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-start justify-center z-50 overflow-y-auto p-4">
      <div className="bg-gray-900 rounded-3xl p-5 w-full max-w-lg border border-gray-700 my-8 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-bold text-lg">Edit Session</div>
            <div className="text-xs text-gray-500">
              {new Date(edited.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-10 h-10 flex items-center justify-center">✕</button>
        </div>

        {edited.exercises?.map((exercise, exIdx) => (
          <div key={exercise.id} className="bg-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-sm">{exercise.name}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateExerciseWeight(exIdx, Math.max(0, exercise.weight - (EXERCISES[exercise.id]?.inc || 5)))}
                  className="w-8 h-8 rounded-full bg-gray-700 font-bold flex items-center justify-center text-sm">−</button>
                <span className="font-bold text-sm w-16 text-center">{exercise.weight}lb</span>
                <button onClick={() => updateExerciseWeight(exIdx, exercise.weight + (EXERCISES[exercise.id]?.inc || 5))}
                  className="w-8 h-8 rounded-full bg-gray-700 font-bold flex items-center justify-center text-sm">+</button>
              </div>
            </div>
            {exercise.sets?.map((set, setIdx) => (
              <div key={setIdx} className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-12">Set {setIdx + 1}</span>
                <input type="number" inputMode="numeric" value={set.reps}
                  onChange={e => updateExerciseSet(exIdx, setIdx, "reps", e.target.value)}
                  className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-center text-sm text-white outline-none focus:border-navy" />
                <span className="text-gray-500 text-xs">reps</span>
                <button onClick={() => updateExerciseSet(exIdx, setIdx, "completed", !set.completed)}
                  className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                    set.completed ? "bg-green-600" : "bg-gray-700"
                  }`}>
                  {set.completed ? "✓" : "○"}
                </button>
              </div>
            ))}
          </div>
        ))}

        <div>
          <div className="text-sm font-semibold mb-2">RPE</div>
          <div className="flex gap-1.5 flex-wrap">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setEdited(prev => ({...prev, rpe: n}))}
                className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                  edited.rpe === n ? "bg-navy text-navy-light" : "bg-gray-800 text-gray-400"
                }`}>{n}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Note</div>
          <textarea value={edited.note || ""} onChange={e => setEdited(prev => ({...prev, note: e.target.value}))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-navy resize-none" rows={2} />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Cancel</button>
          <button onClick={() => onSave(index, edited)} className="flex-1 bg-navy text-navy-light py-3 rounded-xl text-sm font-semibold">Save Changes</button>
        </div>
        {confirmDelete
          ? <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Keep</button>
              <button onClick={() => onDelete(index)} className="flex-1 bg-red-600 py-3 rounded-xl text-sm font-semibold">Yes, Delete</button>
            </div>
          : <button onClick={() => setConfirmDelete(true)} className="w-full bg-gray-800 border border-red-900 py-2 rounded-xl text-xs text-red-400 font-semibold">Delete this session</button>
        }
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose }) {
  const [fileContent, setFileContent] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data.sessions || !Array.isArray(data.sessions)) {
          setError("Invalid backup: missing sessions array.");
          return;
        }
        setFileContent(data);
        setPreview({
          sessions: data.sessions.length,
          bw: data.bwHistory?.length || 0,
          exportDate: data.exportDate || "unknown",
        });
        setError(null);
      } catch {
        setError("Could not parse JSON file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-gray-700 space-y-4">
        <div className="flex justify-between items-center">
          <div className="font-bold text-lg">Import Backup</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl w-10 h-10 flex items-center justify-center">✕</button>
        </div>
        <div className="text-sm text-gray-400">This will replace all current data.</div>
        <input type="file" accept=".json" onChange={handleFile}
          className="w-full text-sm text-gray-400 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
        {error && <div className="text-red-400 text-xs">{error}</div>}
        {preview && (
          <div className="bg-gray-800 rounded-xl p-3 text-xs space-y-1">
            <div className="text-gray-400">Exported: {new Date(preview.exportDate).toLocaleDateString()}</div>
            <div className="text-white">{preview.sessions} sessions · {preview.bw} bodyweight entries</div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-700 py-3 rounded-xl text-sm font-semibold">Cancel</button>
          <button onClick={() => fileContent && onImport(fileContent)} disabled={!fileContent}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold ${fileContent ? "bg-red-600" : "bg-gray-700 opacity-50"}`}>
            Replace Data
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TOOLTIP COMPONENT
   ═══════════════════════════════════════════ */

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-400">{payload[0].payload.date}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}lb</div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: Home
   ═══════════════════════════════════════════ */

function HomeView({ dup, history, bwHistory, nextWorkout, prs, streak, missed, lastGap, fatigue, wEmphasis, setWEmphasis, onStartSession, onStartAccessory, onLogBW, onLogMeasurements }) {
  const weeklyVol = useMemo(() => getWeeklyVolume(history), [history]);
  const [deloadArmed, setDeloadArmed] = useState({});

  return (
    <div className="p-4 space-y-4">
      {/* Item 4: Today hero — the one-glance answer to "what's my session?" */}
      <div className="bg-navy rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-navy-light opacity-80">Up next</div>
          <div className="text-lg font-bold text-white">{WORKOUTS[nextWorkout]?.label || "Workout"}</div>
        </div>
        <button onClick={() => onStartSession(nextWorkout, deloadArmed[nextWorkout])}
          className="bg-navy-light text-navy font-bold py-2.5 px-5 rounded-xl text-sm">
          Start
        </button>
      </div>

      {missed && <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-3 text-sm text-yellow-300">{lastGap} days since last session.</div>}
      {fatigue && <div className="bg-red-950 border border-red-800 rounded-xl p-3 text-sm text-red-300">RPE 8+ for {FATIGUE_WINDOW - 1} straight sessions. Consider a lighter day.</div>}

      {weeklyVol.thisWeek > 0 && (
        <div className="bg-gray-900 rounded-2xl p-3 border border-gray-800">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-500">This week's volume</div>
              <div className="text-lg font-bold text-white">{weeklyVol.thisWeek.toLocaleString()} lb</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">{weeklyVol.sessionCount} session{weeklyVol.sessionCount !== 1 ? "s" : ""}</div>
              {weeklyVol.change !== null && (
                <div className={`text-sm font-semibold ${weeklyVol.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {weeklyVol.change >= 0 ? "+" : ""}{weeklyVol.change}% vs last week
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {["A", "B"].map(workoutKey => {
        const workout = WORKOUTS[workoutKey];
        const isNext = workoutKey === nextWorkout;

        return (
          <div key={workoutKey} className={`bg-gray-900 rounded-2xl p-4 border ${isNext ? "border-navy" : "border-gray-800"}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-bold text-sm">{workout.label}</div>
                {isNext && <span className="text-xs bg-navy text-navy-light px-2 py-0.5 rounded-full font-semibold">Next</span>}
                <button onClick={() => setDeloadArmed(prev => ({ ...prev, [workoutKey]: !prev[workoutKey] }))}
                  className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                    deloadArmed[workoutKey] ? "border-purple-500 text-purple-300 bg-purple-900 bg-opacity-30" : "border-gray-700 text-gray-500"
                  }`}>
                  {deloadArmed[workoutKey] ? "deload on" : "deload"}
                </button>
              </div>
              <button onClick={() => onStartSession(workoutKey, deloadArmed[workoutKey])}
                className={`font-bold py-2 px-4 rounded-xl text-sm ${isNext ? "bg-navy text-navy-light" : "bg-gray-700 text-white"}`}>
                Start
              </button>
            </div>

            {workout.exercises.map(id => {
              const config = EXERCISES[id];
              const dupState = dup[id] || { hW: config.hW, sW: config.sW, hStalls: 0, sStalls: 0, nextType: "hypertrophy" };
              const track = dupState.nextType || workout.defaultEmphasis;
              const isHyp = track === "hypertrophy";
              const weight = isHyp ? dupState.hW : dupState.sW;
              const targetReps = isHyp ? config.repMax : config.sRepMax;
              const repMin = isHyp ? config.repMin : config.sRepMin;
              const prWeight = prs[id]?.weight || 0;
              const estimated = estimateE1RM(weight, targetReps);
              const stalls = isHyp ? dupState.hStalls : dupState.sStalls;

              return (
                <div key={id} className="flex justify-between items-center text-sm py-1.5 border-t border-gray-800">
                  <div>
                    <div className="text-gray-300">
                      {config.name}
                      {weight > prWeight && prWeight > 0 ? " 🎯" : ""}
                    </div>
                    <div className="text-xs text-gray-600">
                      <span style={{ color: TYPE_COLORS[track] }}>{isHyp ? "hyp" : "str"}</span>
                      {stalls > 0 ? ` · ⚠ ${stalls} stall${stalls > 1 ? "s" : ""}` : ""}
                      {prWeight > 0 ? " · PR " + prWeight + "lb" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold" style={{ color: TYPE_COLORS[track] }}>
                      {config.sets}×{repMin}-{targetReps} @ {weight}lb
                    </div>
                    <div className="text-xs text-gray-500">e1RM ~{estimated}lb</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Accessory Session card */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-sm">Accessory Session</div>
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-semibold">freeform</span>
          </div>
          <button onClick={onStartAccessory}
            className="font-bold py-2 px-4 rounded-xl text-sm bg-gray-700 text-white">
            Start
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Pull-ups, arms, core, delts, flies and more. For home-gym or extra days. Counts toward your history and streak.
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onLogBW} className="flex-1 font-semibold py-3 rounded-2xl text-sm bg-gray-800 border border-gray-700 text-gray-300">
          Log Bodyweight
        </button>
        <button onClick={onLogMeasurements} className="flex-1 font-semibold py-3 rounded-2xl text-sm bg-gray-800 border border-gray-700 text-gray-300">
          Measurements
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: Log (Active Session)
   ═══════════════════════════════════════════ */

function LogView({
  session, setSession, elapsed, prs, emphasisOvr, settings,
  accItems, setAccItems, rpe, setRpe, note, setNote, suggested, lastDone, accLastValues, onNotify,
  customTemplates, onToggleOverride, onSwapExercise, onSave, onShowPlates, onShowTimer,
  onShowAccPicker, onShowTemplatePicker, accMode, setAccMode, saved
}) {
  const [swapPickerIdx, setSwapPickerIdx] = useState(null);

  function completeAllSets(exerciseIdx) {
    setSession(prev => {
      const exercises = [...prev.exercises];
      const ex = exercises[exerciseIdx];
      exercises[exerciseIdx] = {
        ...ex,
        sets: ex.sets.map(s => ({
          reps: s.reps || String(ex.targetReps),
          completed: true,
        })),
      };
      return { ...prev, exercises };
    });
    if (settings.autoRestTimer) {
      const ex = session.exercises[exerciseIdx];
      onShowTimer(ex.rest);
    }
  }

  function updateSet(exerciseIdx, setIdx, field, value) {
    setSession(prev => {
      const exercises = [...prev.exercises];
      exercises[exerciseIdx] = {
        ...exercises[exerciseIdx],
        sets: exercises[exerciseIdx].sets.map((set, i) => i === setIdx ? { ...set, [field]: value } : set),
      };
      return { ...prev, exercises };
    });
  }

  function updateWeight(exerciseIdx, direction) {
    setSession(prev => {
      const exercises = [...prev.exercises];
      const exInc = EXERCISES[exercises[exerciseIdx].id]?.inc || 5;
      exercises[exerciseIdx] = {
        ...exercises[exerciseIdx],
        weight: Math.max(0, exercises[exerciseIdx].weight + direction * exInc),
      };
      return { ...prev, exercises };
    });
  }

  function updateAccessory(idx, field, value) {
    setAccItems(prev => prev.map((acc, i) => i === idx ? { ...acc, [field]: value } : acc));
  }

  function removeAccessory(idx) {
    setAccItems(prev => prev.filter((_, i) => i !== idx));
  }

  if (!session) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">{session.label}</h2>
          <div className="text-xs text-gray-500 mt-0.5">{formatSeconds(elapsed)}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onShowPlates} className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full">Plates</button>
          <button onClick={() => onShowTimer(90)} className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full">90s</button>
          <button onClick={() => onShowTimer(180)} className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full">3m</button>
        </div>
      </div>

      {/* Warmup hint (compound days) or accessory intro (accessory day) */}
      {session.workout === "ACC" ? (
        <div className="bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-500">
          Freeform accessory session. Tap "Add Accessory" below to log whatever you want. No required categories.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-500">
          Warmup suggestion: bar ×10 → 50% ×8 → 75% ×5 → working weight
        </div>
      )}

      {/* Exercises */}
      {session.exercises.map((exercise, exIdx) => {
        const config = EXERCISES[exercise.id];
        const prFlag = exercise.weight > (prs[exercise.id]?.weight || 0);
        const slot = WORKOUTS[session.workout]?.slots?.[exIdx];
        const hasAlternates = slot && slot.alternates.length > 0;
        const allSlotOptions = hasAlternates ? [slot.primary, ...slot.alternates] : [];
        const topEstimate = Math.max(
          ...exercise.sets
            .filter(set => set.completed && parseFloat(set.reps) > 0)
            .map(set => estimateE1RM(exercise.weight, parseFloat(set.reps))),
          0
        );
        const bestEstimate = prs[exercise.id]?.e1rm || 0;
        const isOverride = !!emphasisOvr[exercise.id];
        const warmupSets = [
          { pct: 0, label: "Bar", weight: BAR_WEIGHTS[config.bar] || 0 },
          { pct: 0.5, label: "50%", weight: roundToIncrement(exercise.weight * 0.5, EXERCISES[exercise.id]?.inc || 5) },
          { pct: 0.75, label: "75%", weight: roundToIncrement(exercise.weight * 0.75, EXERCISES[exercise.id]?.inc || 5) },
        ].filter(ws => ws.weight > 0 && ws.weight < exercise.weight);

        return (
          <div key={exercise.id + "-" + exIdx} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {exercise.name}
                  {prFlag && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold">PR</span>}
                  {hasAlternates && (
                    <div className="relative">
                      <button onClick={() => setSwapPickerIdx(swapPickerIdx === exIdx ? null : exIdx)}
                        className="text-xs px-2 py-0.5 rounded border border-gray-600 text-gray-400 active:bg-gray-700">
                        swap ▾
                      </button>
                      {swapPickerIdx === exIdx && (
                        <div className="absolute left-0 top-7 z-20 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg min-w-44">
                          {allSlotOptions.map(optId => (
                            <button key={optId}
                              onClick={() => { onSwapExercise(exIdx, optId); setSwapPickerIdx(null); }}
                              className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                                optId === exercise.id ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-700"
                              }`}>
                              {EXERCISES[optId]?.name}
                              {optId === exercise.id && " ✓"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {exercise.note && <div className="text-xs text-gray-500">{exercise.note}</div>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: TYPE_COLORS[exercise.sessionType] + "33", color: TYPE_COLORS[exercise.sessionType] }}>
                    {exercise.sessionType}
                  </span>
                  {config.priority && (
                    <button onClick={() => onToggleOverride(exercise.id)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        isOverride ? "border-orange-500 text-orange-400" : "border-gray-600 text-gray-500"
                      }`}>
                      {isOverride ? "override" : "default"}
                    </button>
                  )}
                  <span className="text-xs text-gray-500">{exercise.repMin}-{exercise.targetReps} reps</span>
                  {exercise.stalls > 0 && <span className="text-xs text-yellow-600">{exercise.stalls}/{exercise.stallN} stalls</span>}
                </div>
                {topEstimate > 0 && (
                  <div className="text-xs text-purple-400 mt-0.5">
                    e1RM ~{topEstimate}lb{topEstimate > bestEstimate ? " PR" : ""}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateWeight(exIdx, -1)}
                  className="w-10 h-10 rounded-full bg-gray-700 font-bold flex items-center justify-center text-lg active:bg-gray-600">−</button>
                <span className="font-bold text-sm w-16 text-center" style={{ color: TYPE_COLORS[exercise.sessionType] }}>
                  {exercise.weight}lb
                </span>
                <button onClick={() => updateWeight(exIdx, 1)}
                  className="w-10 h-10 rounded-full bg-gray-700 font-bold flex items-center justify-center text-lg active:bg-gray-600">+</button>
              </div>
            </div>

            {exercise.isDeload && (
              <div className="bg-purple-900 bg-opacity-30 border border-purple-800 rounded-lg px-3 py-1.5 mb-2 text-xs text-purple-300">
                Deload · working weight is {exercise.workingWeight}lb (preserved, won't change)
              </div>
            )}

            {exercise.derivedWeight && !exercise.isDeload && (
              <div className="bg-blue-900 bg-opacity-30 border border-blue-800 rounded-lg px-3 py-1.5 mb-2 text-xs text-blue-300">
                Estimated start · this track was dormant, weight {exercise.derivationNote}. Adjust if it feels off.
              </div>
            )}

            {/* Inline plate breakdown */}
            {(() => {
              if (config.bar === "dumbbell") return (
                <div className="bg-gray-800 rounded-lg px-3 py-1.5 mb-2 text-xs text-gray-500">
                  <span className="text-gray-300">{exercise.weight}lb</span> per dumbbell
                </div>
              );
              const barW = BAR_WEIGHTS[config.bar] || 0;
              const plates = calculatePlates(exercise.weight, barW);
              if (plates.length === 0 && barW > 0) return (
                <div className="bg-gray-800 rounded-lg px-3 py-1.5 mb-2 text-xs text-gray-500">Bar only ({barW}lb)</div>
              );
              if (plates.length === 0) return null;
              return (
                <div className="bg-gray-800 rounded-lg px-3 py-1.5 mb-2 text-xs text-gray-500">
                  Each side: <span className="text-gray-300">{plates.map(p => p.count > 1 ? `${p.plate}×${p.count}` : `${p.plate}`).join(" + ")}</span>
                  {barW > 0 ? ` · Bar: ${barW}lb` : " · No bar"}
                </div>
              );
            })()}

            {/* Warmup sets (collapsible) */}
            {warmupSets.length > 0 && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 mb-2 text-xs text-gray-500">
                <span className="text-gray-600">Warmup: </span>
                {warmupSets.map((ws, i) => (
                  <span key={i} className="mr-3">{ws.label} {ws.weight}lb ×{i === 0 ? 10 : i === 1 ? 8 : 5}</span>
                ))}
              </div>
            )}

            {/* Previous session reference */}
            {exercise.lastSets && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 mb-3 text-xs text-gray-400">
                <span className="text-gray-500">Last @ {exercise.lastWeight}lb: </span>
                {exercise.lastSets.map((set, i) => (
                  <span key={i} className={`mr-2 ${set.completed ? "text-green-400" : "text-gray-500"}`}>
                    {set.reps || "—"}
                  </span>
                ))}
              </div>
            )}

            {/* Working sets */}
            <div className="space-y-2">
              {exercise.sets.map((set, setIdx) => (
                <div key={setIdx} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-12">Set {setIdx + 1}</span>
                  <input type="number" inputMode="numeric" placeholder={"" + exercise.targetReps}
                    value={set.reps}
                    onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-center text-sm focus:border-navy outline-none text-white" />
                  <span className="text-gray-500 text-xs">reps</span>
                  {set.reps && <span className="text-purple-400 text-xs">~{estimateE1RM(exercise.weight, parseFloat(set.reps) || 1)}lb</span>}
                  <button
                    onClick={() => {
                      updateSet(exIdx, setIdx, "completed", !set.completed);
                      if (!set.completed && set.reps && settings.autoRestTimer) onShowTimer(exercise.rest);
                    }}
                    className={`ml-auto w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors active:scale-95 ${
                      set.completed ? "bg-green-600" : "bg-gray-700"
                    }`}>
                    {set.completed ? "✓" : "○"}
                  </button>
                </div>
              ))}
            </div>
            {!exercise.sets.every(s => s.completed) && (
              <button onClick={() => completeAllSets(exIdx)}
                className="mt-2 w-full py-2 rounded-xl text-xs font-semibold bg-green-900 bg-opacity-40 border border-green-800 text-green-300 active:bg-opacity-60">
                ✓ Complete all sets at shown reps
              </button>
            )}
            <div className="mt-2 text-xs text-gray-600">
              Progress at {exercise.targetReps} reps all sets → +{EXERCISES[exercise.id]?.inc || 5}lb
            </div>
          </div>
        );
      })}

      {/* Required Accessory Categories (not shown for freeform accessory sessions) */}
      {session?.workout && session.workout !== "ACC" && (() => {
        const reqCats = getRequiredCategories(session.workout);
        const catStatus = checkCategoryCompletion(reqCats, accItems);
        const allDone = catStatus.every(c => c.completed);
        return (
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">Required Categories</div>
              {allDone && <span className="text-xs text-green-400">All complete ✓</span>}
            </div>
            <div className="space-y-2">
              {catStatus.map(cat => (
                <div key={cat.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  cat.completed ? "bg-green-900 bg-opacity-30 border border-green-800" : "bg-gray-800 border border-gray-700"
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                    cat.completed ? "bg-green-600" : "bg-gray-700"
                  }`}>
                    {cat.completed ? "✓" : "○"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${cat.completed ? "text-green-300" : "text-gray-300"}`}>{cat.label}</div>
                    <div className="text-xs text-gray-500">
                      {cat.completed
                        ? cat.matchedAccName
                        : cat.eligible.map(id => ACCESSORIES.find(a => a.id === id)?.name).filter(Boolean).join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Accessories */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <div className="font-semibold">Accessory Work</div>
          <div className="flex gap-2">
            <button onClick={onShowTemplatePicker} className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full">📋</button>
            <button onClick={onShowAccPicker} className="text-xs bg-navy text-navy-light px-3 py-1.5 rounded-full">+ Add</button>
          </div>
        </div>
        {accItems.length === 0 && (
          <div className="text-xs text-gray-600 mb-2">No accessories. Tap + Add or load a template.</div>
        )}
        {accItems.map((acc, idx) => (
          <div key={acc.id} className={`py-2.5 border-t border-gray-800 ${acc.done ? "opacity-60" : ""}`}>
            {/* Row 1: check + name + delete */}
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => {
                if (!acc.done && !acc.unloaded && !(acc.weight && parseFloat(acc.weight) > 0)) {
                  onNotify(`Enter a weight for ${acc.name}, or tap "BW" if it's bodyweight or unloaded.`);
                  return;
                }
                updateAccessory(idx, "done", !acc.done);
              }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-colors ${
                  acc.done ? "bg-green-600" : "bg-gray-700"
                }`}>
                {acc.done ? "✓" : "○"}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">
                  {acc.name}
                  {suggested.includes(acc.id) && <span className="text-xs text-blue-300 ml-1">★</span>}
                </div>
                {lastDone[acc.id] && <div className="text-xs text-gray-600">{daysSinceDate(lastDone[acc.id])}d ago</div>}
              </div>
              <button onClick={() => removeAccessory(idx)}
                className="text-gray-500 hover:text-red-400 text-lg leading-none flex-shrink-0 w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            {/* Row 2: sets × reps @ weight + BW toggle */}
            <div className="flex items-center gap-2 pl-10">
              <div className="flex items-center gap-1">
                <input type="number" inputMode="numeric" value={acc.sets}
                  onChange={e => updateAccessory(idx, "sets", e.target.value)}
                  className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-1 py-1.5 text-center text-sm text-white outline-none" />
                <span className="text-xs text-gray-500">sets</span>
              </div>
              <span className="text-xs text-gray-600">×</span>
              <div className="flex items-center gap-1">
                <input type="number" inputMode="numeric" value={acc.reps}
                  onChange={e => updateAccessory(idx, "reps", e.target.value)}
                  className="w-12 bg-gray-800 border border-gray-700 rounded-lg px-1 py-1.5 text-center text-sm text-white outline-none" />
                <span className="text-xs text-gray-500">reps</span>
              </div>
              <span className="text-xs text-gray-600">@</span>
              {acc.unloaded ? (
                <button onClick={() => updateAccessory(idx, "unloaded", false)}
                  className="w-16 text-center text-xs text-blue-300 bg-blue-900 bg-opacity-30 border border-blue-800 rounded-lg py-1.5">BW</button>
              ) : (
                <div className="flex items-center gap-1">
                  <input type="number" inputMode="decimal"
                    placeholder={accLastValues[acc.id]?.weight ? String(accLastValues[acc.id].weight) : "lb"}
                    value={acc.weight}
                    onChange={e => updateAccessory(idx, "weight", e.target.value)}
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-1 py-1.5 text-center text-sm text-white outline-none" />
                  <span className="text-xs text-gray-500">lb</span>
                </div>
              )}
              <button onClick={() => updateAccessory(idx, "unloaded", !acc.unloaded)}
                title="Bodyweight / unloaded"
                className={`text-xs flex-shrink-0 px-2 py-1.5 rounded-lg border ml-auto ${acc.unloaded ? "text-blue-300 border-blue-800 bg-blue-900 bg-opacity-30" : "text-gray-500 border-gray-700"}`}>BW</button>
            </div>
          </div>
        ))}
      </div>

      {/* RPE */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="text-sm font-semibold mb-3">Session RPE</div>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} onClick={() => setRpe(n)}
              className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                rpe === n ? "bg-navy text-navy-light" : "bg-gray-800 text-gray-400"
              }`}>{n}</button>
          ))}
        </div>
        {rpe && (
          <div className="mt-2 text-xs text-gray-500">
            {rpe <= 4 ? "Easy" : rpe <= 6 ? "Moderate — on track" : rpe <= 8 ? "Hard — good stimulus" : "Very hard — monitor recovery"}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="text-sm font-semibold mb-2">Session Note</div>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. felt flat, great energy, knee tight..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-navy resize-none" rows={2} />
      </div>

      {/* Complete */}
      <button onClick={onSave}
        className={`w-full font-bold py-4 rounded-2xl text-lg transition-colors ${
          saved ? "bg-green-600" : "bg-navy text-navy-light active:opacity-80"
        }`}>
        {saved ? "Saved!" : `Complete · ${formatSeconds(elapsed)}`}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: History
   ═══════════════════════════════════════════ */

function HistoryView({ history, onEdit }) {
  const editableCount = Math.min(EDITABLE_SESSION_COUNT, history.length);

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-bold text-lg">Session History</h2>
      {history.length === 0 && <div className="text-gray-500 text-sm">No sessions logged yet.</div>}

      {[...history].reverse().map((session, reverseIdx) => {
        const realIdx = history.length - 1 - reverseIdx;
        const isEditable = reverseIdx < editableCount;

        return (
          <div key={reverseIdx} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-sm">{session.label}</span>
              <div className="flex gap-2 items-center">
                {session.rpe && <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full">RPE {session.rpe}</span>}
                {session.duration > 0 && <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full">{session.duration}m</span>}
                {(() => { const vol = getSessionVolume(session); return vol > 0 ? <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-green-400">{Math.round(vol).toLocaleString()} lb</span> : null; })()}
                {isEditable && session.workout !== "ACC" && (
                  <button onClick={() => onEdit(realIdx)}
                    className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full text-blue-300 hover:bg-gray-700">
                    Edit
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {new Date(session.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </div>

            {session.exercises?.map(exercise => {
              const completedSets = exercise.sets.filter(set => set.completed).length;
              const topEstimate = Math.max(
                ...(exercise.sets?.filter(set => set.completed && parseFloat(set.reps) > 0)
                  .map(set => estimateE1RM(exercise.weight, parseFloat(set.reps))) || [0]),
                0
              );
              return (
                <div key={exercise.id} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-400">{exercise.name}</span>
                  <span className="text-gray-300">
                    {exercise.weight}lb · {completedSets}/{exercise.sets?.length} sets
                    {topEstimate > 0 ? ` · ~${topEstimate}lb` : ""}
                  </span>
                </div>
              );
            })}

            {session.accessories?.filter(acc => acc.done || acc.sets).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <div className="text-xs text-gray-500 font-medium mb-1">Accessories</div>
                {session.accessories.filter(acc => acc.done || acc.sets).map(acc => (
                  <div key={acc.id} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-500">{acc.name}</span>
                    <span className="text-gray-400">
                      {acc.sets}×{acc.reps}{acc.weight ? " @ " + acc.weight + "lb" : ""}{acc.done ? " ✓" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {session.note && (
              <div className="mt-2 text-xs text-gray-500 italic border-t border-gray-800 pt-2">"{session.note}"</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   VIEW: Progress
   ═══════════════════════════════════════════ */

function ProgressView({ history, dup, prs, bwHistory, measurements, selEx, setSelEx, onExport, onShowImport }) {
  // Finding E: run analytics over cleaned data (ghosts excluded, outliers filtered)
  const cleanHist = useMemo(() => cleanSessions(history), [history]);
  const cleanBw = useMemo(() => cleanBwHistory(bwHistory), [bwHistory]);
  const cleanMeas = useMemo(() => cleanMeasurements(measurements), [measurements]);
  const volumeData = useMemo(() => getVolumeHistory(cleanHist), [cleanHist]);
  const calendarData = useMemo(() => getCalendarData(cleanHist), [cleanHist]);
  const muscleSets = useMemo(() => getWeeklyMuscleSets(cleanHist), [cleanHist]);
  const regressions = useMemo(() => getRegressions(cleanHist, dup), [cleanHist, dup]);
  return (
    <div className="p-4 space-y-5">
      <h2 className="font-bold text-lg">Progress</h2>

      {/* Item 3: quick-jump nav so the long Progress tab isn't a blind scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { id: "sec-week", label: "This Week" },
          { id: "sec-lifts", label: "Lifts" },
          { id: "sec-body", label: "Body" },
          { id: "sec-data", label: "Data" },
        ].map(s => (
          <button key={s.id}
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex-shrink-0 text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full">
            {s.label}
          </button>
        ))}
      </div>

      {/* P3-d: Regression flags */}
      {regressions.length > 0 && (
        <div className="bg-red-950 bg-opacity-40 rounded-2xl p-4 border border-red-900">
          <div className="font-semibold mb-2 text-red-300">⚠ Regressed lifts (below 8-week peak)</div>
          <div className="space-y-1">
            {regressions.map((r, i) => (
              <div key={i} className="text-xs text-red-200 flex justify-between">
                <span>{r.name} ({r.track})</span>
                <span>{r.now}lb · peak was {r.peak}lb</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P3-b: Weekly sets by muscle group */}
      <div id="sec-week" className="bg-gray-900 rounded-2xl p-4 border border-gray-800 scroll-mt-4">
        <div className="font-semibold mb-1">Weekly Sets by Muscle</div>
        <div className="text-xs text-gray-500 mb-3">Last 7 days · target ranges shown</div>
        <div className="space-y-2">
          {Object.entries(MUSCLE_TARGETS).map(([muscle, [lo, hi]]) => {
            const val = Math.round((muscleSets[muscle] || 0) * 10) / 10;
            const status = val < lo ? "under" : val > hi ? "over" : "on";
            const color = status === "under" ? "#f87171" : status === "over" ? "#fbbf24" : "#22c55e";
            const pct = Math.min(100, (val / hi) * 100);
            return (
              <div key={muscle}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-300">{muscle}</span>
                  <span style={{ color }}>{val} / {lo}-{hi}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-600 mt-3">Estimates from completed sets. Secondary muscles get partial credit.</div>
      </div>

      {/* Training Calendar */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="font-semibold mb-3">Training Calendar</div>
        {(() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
          const cells = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          return (
            <>
              <div className="text-xs text-gray-400 mb-2">{monthLabel}</div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center text-xs text-gray-600">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const entry = calendarData[dateKey];
                  const isToday = day === now.getDate();
                  const bgColor = entry
                    ? entry.workout === "A" ? "bg-navy" : entry.workout === "B" ? "bg-orange-900" : "bg-purple-900"
                    : "bg-gray-800";
                  const textColor = entry
                    ? entry.workout === "A" ? "text-navy-light" : entry.workout === "B" ? "text-orange-300" : "text-purple-300"
                    : "text-gray-500";
                  return (
                    <div key={i} className={`rounded-lg p-1 text-center text-xs ${bgColor} ${textColor} ${isToday ? "ring-1 ring-white" : ""}`}>
                      {day}
                      {entry && <div className="text-[8px] leading-none mt-0.5">{entry.workout === "ACC" ? "AC" : entry.workout}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-navy" /> Workout A</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-900" /> Workout B</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-900" /> Accessory</div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Volume Trend */}
      {volumeData.length >= 2 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="font-semibold mb-1">Session Volume</div>
          <div className="text-xs text-gray-500 mb-3">Total weight moved per session (sets x reps x weight)</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={volumeData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]}
                tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                    <div className="text-gray-400">{payload[0].payload.date}</div>
                    <div className="text-green-400 font-bold">{payload[0].value.toLocaleString()} lb</div>
                    <div className="text-gray-500">Workout {payload[0].payload.workout}</div>
                  </div>
                ) : null
              } />
              <Line type="monotone" dataKey="volume" name="Volume" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Duration Stats */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="font-semibold mb-3">Workout Duration</div>
        {["A", "B"].map(workoutKey => {
          const stats = getDurationStats(cleanHist, workoutKey);
          return (
            <div key={workoutKey} className="mb-3">
              <div className="text-xs text-gray-400 mb-1">{WORKOUTS[workoutKey].label}</div>
              {!stats
                ? <div className="text-xs text-gray-600">No data yet</div>
                : <div className="grid grid-cols-4 gap-2">
                    {[["Last", stats.last], ["Avg", stats.avg], ["Best", stats.fastest], ["Long", stats.longest]].map(([label, val]) => (
                      <div key={label} className="bg-gray-800 rounded-xl p-2 text-center">
                        <div className="font-bold text-sm">{val}m</div>
                        <div className="text-xs text-gray-500">{label}</div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          );
        })}
      </div>

      {/* Current Working Weights (expandable with charts) */}
      <div id="sec-lifts" className="bg-gray-900 rounded-2xl p-4 border border-gray-800 scroll-mt-4">
        <div className="font-semibold mb-3">Current Working Weights</div>
        {ALL_COMPOUND_IDS.map(id => {
          const config = EXERCISES[id];
          const dupState = dup[id] || { hW: config.hW, sW: config.sW, hStalls: 0, sStalls: 0 };
          const isExpanded = selEx === id;
          const sessions = history.filter(session => session.exercises?.find(ex => ex.id === id));
          const chartData = sessions.map(session => {
            const exercise = session.exercises.find(ex => ex.id === id);
            return {
              date: new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
              hW: exercise.sessionType === "hypertrophy" ? exercise.weight : null,
              sW: exercise.sessionType === "strength" ? exercise.weight : null,
            };
          });

          return (
            <div key={id} className="border-t border-gray-800">
              <button onClick={() => setSelEx(selEx === id ? null : id)}
                className="w-full flex justify-between items-center py-2.5 text-left">
                <span className="text-gray-300 text-sm font-medium">{config.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-blue-300 text-xs">{dupState.hW}lb{dupState.hStalls > 0 ? ` ⚠${dupState.hStalls}` : ""}</span>
                  <span className="text-orange-400 text-xs">{dupState.sW}lb{dupState.sStalls > 0 ? ` ⚠${dupState.sStalls}` : ""}</span>
                  <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>
              {isExpanded && (
                <div className="pb-3">
                  {chartData.length < 2
                    ? <div className="text-xs text-gray-600 text-center py-4">Log 2+ sessions to see trend</div>
                    : <>
                        <div className="flex gap-4 mb-2">
                          <div><div className="text-gray-500 text-xs">Hyp now</div><div className="text-blue-300 font-bold text-sm">{dupState.hW}lb</div></div>
                          <div><div className="text-gray-500 text-xs">Str now</div><div className="text-orange-400 font-bold text-sm">{dupState.sW}lb</div></div>
                          <div><div className="text-gray-500 text-xs">Sessions</div><div className="text-gray-300 font-bold text-sm">{sessions.length}</div></div>
                        </div>
                        <ResponsiveContainer width="100%" height={130}>
                          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: "9px" }} />
                            <Line type="monotone" dataKey="hW" name="Hypertrophy" stroke="#93c5fd" strokeWidth={2} dot={{ r: 3, fill: "#93c5fd" }} connectNulls />
                            <Line type="monotone" dataKey="sW" name="Strength" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Personal Records */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="font-semibold mb-3">Personal Records</div>
        {ALL_COMPOUND_IDS.map(id => {
          const config = EXERCISES[id];
          const pr = prs[id];
          return (
            <div key={id} className="flex justify-between text-sm py-0.5">
              <span className="text-gray-400">{config.name}</span>
              <div>
                <span className="text-yellow-400 font-semibold">{pr.weight || "—"}lb</span>
                {pr.e1rm > 0 && <span className="text-purple-400 text-xs ml-2">~{pr.e1rm}lb</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weight Progression (selected exercise) */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="font-semibold mb-3">Weight Progression</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_COMPOUND_IDS.map(id => (
            <button key={id} onClick={() => setSelEx(id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selEx === id ? "bg-navy border-navy text-navy-light" : "border-gray-700 text-gray-400"
              }`}>
              {EXERCISES[id].name.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>
        {(() => {
          if (!selEx) return null;
          const sessions = history.filter(session => session.exercises?.find(ex => ex.id === selEx));
          if (sessions.length < 2) return <div className="text-gray-600 text-xs text-center py-6">Log 2+ sessions to see trend</div>;
          let maxHyp = 0, maxStr = 0;
          const data = sessions.map((session, idx) => {
            const exercise = session.exercises.find(ex => ex.id === selEx);
            const isHyp = exercise.sessionType === "hypertrophy";
            const weight = exercise.weight;
            if (isHyp && weight > maxHyp) maxHyp = weight;
            if (!isHyp && weight > maxStr) maxStr = weight;
            return {
              i: idx + 1,
              date: new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              hW: isHyp ? weight : null,
              sW: !isHyp ? weight : null,
            };
          });
          const weights = sessions.map(session => session.exercises.find(ex => ex.id === selEx)?.weight || 0);
          const totalGain = weights[weights.length - 1] - weights[0];
          return (
            <>
              <div className="flex gap-4 mb-3">
                <div><div className="text-gray-500 text-xs">Hyp PR</div><div className="text-blue-300 font-bold text-sm">{maxHyp || "—"}lb</div></div>
                <div><div className="text-gray-500 text-xs">Str PR</div><div className="text-orange-400 font-bold text-sm">{maxStr || "—"}lb</div></div>
                <div><div className="text-gray-500 text-xs">Overall gain</div><div className={`font-bold text-sm ${totalGain >= 0 ? "text-green-400" : "text-red-400"}`}>{totalGain >= 0 ? "+" : ""}{totalGain}lb</div></div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="hW" name="Hypertrophy" stroke="#93c5fd" strokeWidth={2} dot={{ r: 3, fill: "#93c5fd" }} connectNulls />
                  <Line type="monotone" dataKey="sW" name="Strength" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </>
          );
        })()}
      </div>

      {/* e1RM vs Bodyweight */}
      {(() => {
        if (!selEx) return null;
        const bwMap = {};
        bwHistory.forEach(entry => {
          bwMap[new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })] = entry.weight;
        });
        const sessions = history.filter(session => session.exercises?.find(ex => ex.id === selEx));
        if (sessions.length < 2) return null;
        const data = sessions.map(session => {
          const exercise = session.exercises.find(ex => ex.id === selEx);
          const topE = Math.max(
            ...(exercise.sets?.filter(set => set.completed && parseFloat(set.reps) > 0)
              .map(set => estimateE1RM(exercise.weight, parseFloat(set.reps))) || [0]),
            0
          );
          const dateLabel = new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return { date: dateLabel, e1RM: topE || null, bw: bwMap[dateLabel] || null };
        });
        return (
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="font-semibold mb-1">e1RM vs Bodyweight</div>
            <div className="text-xs text-gray-500 mb-3">{EXERCISES[selEx]?.name}</div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
                <YAxis yAxisId="l" tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Line yAxisId="l" type="monotone" dataKey="e1RM" name="e1RM" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: "#a855f7" }} connectNulls />
                <Line yAxisId="r" type="monotone" dataKey="bw" name="Bodyweight" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: "#f59e0b" }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* RPE Trend */}
      {history.filter(session => session.rpe).length >= 2 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="font-semibold mb-1">RPE Trend</div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart
              data={history.filter(session => session.rpe).map((session, idx) => ({
                i: idx + 1,
                rpe: session.rpe,
                date: new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
              <YAxis domain={[1, 10]} tick={{ fontSize: 9, fill: "#6b7280" }} />
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                    <div className="text-gray-400">{payload[0].payload.date}</div>
                    <div className="text-white font-bold">RPE {payload[0].value}</div>
                  </div>
                ) : null
              } />
              <Line type="monotone" dataKey="rpe" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: "#a855f7" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div id="sec-body" className="scroll-mt-4"></div>
      {/* Bodyweight Trend */}
      {bwHistory.length >= 2 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="font-semibold mb-1">Bodyweight Trend</div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart
              data={cleanBw.map(entry => ({
                date: new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                weight: entry.weight,
              }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                    <div className="text-gray-400">{payload[0].payload.date}</div>
                    <div className="text-white font-bold">{payload[0].value}lb</div>
                  </div>
                ) : null
              } />
              <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Start: {bwHistory[0]?.weight}lb</span>
            <span>Now: {bwHistory[bwHistory.length - 1]?.weight}lb</span>
            <span className={(bwHistory[bwHistory.length - 1]?.weight - bwHistory[0]?.weight) >= 0 ? "text-green-400" : "text-red-400"}>
              {(bwHistory[bwHistory.length - 1]?.weight - bwHistory[0]?.weight) >= 0 ? "+" : ""}
              {(bwHistory[bwHistory.length - 1]?.weight - bwHistory[0]?.weight)?.toFixed(1)}lb
            </span>
          </div>
        </div>
      )}

      {/* Body Measurements */}
      {measurements.length >= 1 && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="font-semibold mb-1">Body Measurements</div>
          <div className="text-xs text-gray-500 mb-3">Tracked in inches</div>
          {/* Latest values */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {MEASUREMENT_FIELDS.map(field => {
              const latest = measurements[measurements.length - 1]?.[field.id];
              const first = measurements[0]?.[field.id];
              const diff = latest && first ? (latest - first).toFixed(1) : null;
              return (
                <div key={field.id} className="bg-gray-800 rounded-xl p-2 text-center">
                  <div className="font-bold text-sm text-white">{latest ?? "—"}</div>
                  <div className="text-xs text-gray-500">{field.label}</div>
                  {diff !== null && measurements.length >= 2 && (
                    <div className={`text-xs ${parseFloat(diff) > 0 ? "text-green-400" : parseFloat(diff) < 0 ? "text-red-400" : "text-gray-500"}`}>
                      {parseFloat(diff) > 0 ? "+" : ""}{diff}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Chart if 2+ entries */}
          {measurements.length >= 2 && (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart
                data={cleanMeas.map(entry => ({
                  date: new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  ...MEASUREMENT_FIELDS.reduce((acc, f) => ({ ...acc, [f.label]: entry[f.id] || null }), {}),
                }))}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                <Tooltip content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                      <div className="text-gray-400 mb-1">{payload[0].payload.date}</div>
                      {payload.filter(p => p.value != null).map((p, i) => (
                        <div key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}"</div>
                      ))}
                    </div>
                  ) : null
                } />
                <Legend wrapperStyle={{ fontSize: "9px" }} />
                <Line type="monotone" dataKey="Chest" stroke="#f472b6" strokeWidth={2} dot={{ r: 2, fill: "#f472b6" }} connectNulls />
                <Line type="monotone" dataKey="Waist" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2, fill: "#fbbf24" }} connectNulls />
                <Line type="monotone" dataKey="Arms" stroke="#34d399" strokeWidth={2} dot={{ r: 2, fill: "#34d399" }} connectNulls />
                <Line type="monotone" dataKey="Legs" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2, fill: "#a78bfa" }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Accessory Frequency */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="font-semibold mb-3">Accessory Frequency</div>
        {(() => {
          const accStats = {};
          ACCESSORIES.forEach(acc => { accStats[acc.id] = { name: acc.name, muscle: acc.muscle, count: 0, lastDate: null, weightHistory: [] }; });
          history.forEach(session => {
            session.accessories?.filter(acc => acc.done || acc.sets).forEach(acc => {
              if (!accStats[acc.id]) return;
              accStats[acc.id].count++;
              if (!accStats[acc.id].lastDate || new Date(session.date) > new Date(accStats[acc.id].lastDate)) {
                accStats[acc.id].lastDate = session.date;
              }
              if (acc.weight) {
                accStats[acc.id].weightHistory.push({
                  date: new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
                  weight: parseFloat(acc.weight), sets: acc.sets, reps: acc.reps,
                });
              }
            });
          });
          const sorted = ACCESSORIES.map(acc => ({ ...accStats[acc.id], id: acc.id })).sort((a, b) => b.count - a.count);
          return sorted.map(acc => {
            const isExpanded = selEx === acc.id + "_acc";
            const hasWeightData = acc.weightHistory.length >= 2;
            return (
              <div key={acc.id} className="border-t border-gray-800">
                <button onClick={() => setSelEx(selEx === acc.id + "_acc" ? null : acc.id + "_acc")}
                  className="w-full flex justify-between items-center py-2.5 text-left">
                  <div>
                    <span className="text-gray-300 text-sm">{acc.name}</span>
                    <span className="text-gray-600 text-xs ml-2">{acc.muscle}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs">{acc.count > 0 ? acc.count + "× logged" : "never"}</span>
                    {acc.lastDate && <span className="text-gray-600 text-xs">{daysSinceDate(acc.lastDate)}d ago</span>}
                    <span className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="pb-3">
                    {acc.count === 0
                      ? <div className="text-xs text-gray-600 text-center py-3">Not logged yet</div>
                      : <>
                          {hasWeightData
                            ? <>
                                <div className="text-xs text-gray-500 mb-2">Weight progression (detailed mode)</div>
                                <ResponsiveContainer width="100%" height={110}>
                                  <LineChart data={acc.weightHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} />
                                    <Tooltip content={({ active, payload }) =>
                                      active && payload?.length ? (
                                        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                                          <div className="text-gray-400">{payload[0].payload.date}</div>
                                          <div className="text-green-400 font-bold">{payload[0].value}lb</div>
                                          <div className="text-gray-500">{payload[0].payload.sets}×{payload[0].payload.reps}</div>
                                        </div>
                                      ) : null
                                    } />
                                    <Line type="monotone" dataKey="weight" name="Weight" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </>
                            : <div className="text-xs text-gray-600 mb-2">No weight data — log with detailed mode to track</div>
                          }
                          <div className="flex gap-4 mt-2">
                            <div><div className="text-gray-500 text-xs">Times logged</div><div className="text-gray-300 font-bold text-sm">{acc.count}</div></div>
                            {acc.lastDate && <div><div className="text-gray-500 text-xs">Last done</div><div className="text-gray-300 font-bold text-sm">{new Date(acc.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></div>}
                            {hasWeightData && <div><div className="text-gray-500 text-xs">Best</div><div className="text-green-400 font-bold text-sm">{Math.max(...acc.weightHistory.map(w => w.weight))}lb</div></div>}
                          </div>
                        </>
                    }
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Export / Import */}
      <div id="sec-data" className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-3 scroll-mt-4">
        <div className="font-semibold mb-1">Data Management</div>
        <div className="text-xs text-gray-500">Full backup of sessions, weights and bodyweight.</div>
        <button onClick={onExport}
          className="w-full bg-gray-700 border border-gray-600 font-semibold py-3 rounded-xl text-sm text-white">
          Export Backup JSON
        </button>
        <button onClick={onShowImport}
          className="w-full bg-gray-800 border border-gray-700 font-semibold py-3 rounded-xl text-sm text-gray-400">
          Import Backup
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════ */

export default function App() {
  const storage = useWorkoutStorage();
  const {
    history, dup, bwHistory, measurements, nextWorkout, settings, customTemplates, loading, recoveredSession,
    saveHistory, saveDup, saveNextWorkout, saveBW, saveMeasurements, saveActiveSession, clearActiveSession,
    updateHistorySession, deleteHistorySession, saveSettings, saveCustomTemplates, setRecoveredSession,
  } = storage;

  const [view, setView] = useState("home");
  const [session, setSession] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [restSecs, setRestSecs] = useState(90);
  const [showPlates, setShowPlates] = useState(false);
  const [showBW, setShowBW] = useState(false);
  const [selEx, setSelEx] = useState(ALL_COMPOUND_IDS[0]);
  const [rpe, setRpe] = useState(null);
  const [note, setNote] = useState("");
  const [sessStart, setSessStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [resets, setResets] = useState([]);
  const [accMode, setAccMode] = useState("quick");
  const [accItems, setAccItems] = useState([]);
  const [showAccPicker, setShowAccPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [emphasisOvr, setEmphasisOvr] = useState({});
  const [slotSelections, setSlotSelections] = useState({});
  const [wEmphasis, setWEmphasis] = useState({});
  const [navGuard, setNavGuard] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [saveSummary, setSaveSummary] = useState(null);
  const [appAlert, setAppAlert] = useState(null);
  const timerRef = useRef();

  // Sunday BW prompt
  useEffect(() => {
    if (!loading && isSunday()) {
      const today = new Date().toDateString();
      if (!bwHistory.some(entry => new Date(entry.date).toDateString() === today)) {
        setTimeout(() => setShowBW(true), 800);
      }
    }
  }, [loading, bwHistory]);

  // Measurements prompt every 28 days (7-day grace period for first prompt)
  useEffect(() => {
    if (loading) return;
    const lastMeasurement = measurements[measurements.length - 1];
    if (!lastMeasurement) {
      // Never logged: prompt only after using the app for 7+ days
      const firstSession = history[0];
      if (firstSession && daysSinceDate(firstSession.date) >= 7) {
        setTimeout(() => setShowMeasurements(true), 1200);
      }
    } else {
      const daysSinceLast = daysSinceDate(lastMeasurement.date);
      if (daysSinceLast >= MEASUREMENT_PROMPT_DAYS) {
        setTimeout(() => setShowMeasurements(true), 1200);
      }
    }
  }, [loading, measurements, history]);

  // Session elapsed timer
  useEffect(() => {
    if (session && sessStart) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - sessStart) / 1000)), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [session, sessStart]);

  // Auto-save active session when meaningful data changes (not on timer tick)
  useEffect(() => {
    if (session && sessStart) {
      const sessionSnapshot = {
        session, accItems, rpe, note, emphasisOvr, accMode, slotSelections,
        sessStart, elapsed: Math.floor((Date.now() - sessStart) / 1000),
        timestamp: Date.now(),
      };
      saveActiveSession(sessionSnapshot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, accItems, rpe, note, emphasisOvr, accMode, sessStart, saveActiveSession]);

  // Derived values
  const prs = useMemo(() => getPersonalRecords(history), [history]);
  const streak = useMemo(() => getWeeklyStreak(history), [history]);
  const lastDone = useMemo(() => getAccessoryLastDone(history), [history]);
  const accLastValues = useMemo(() => getAccessoryLastValues(history), [history]);
  const suggested = useMemo(() => getSuggestedAccessories(history), [history]);

  const lastGap = history.length ? daysSinceDate(history[history.length - 1].date) : null;
  const missed = lastGap !== null && lastGap > MISSED_THRESHOLD_DAYS;
  const recentRPEs = history.slice(-FATIGUE_WINDOW).map(session => session.rpe).filter(Boolean);
  const fatigue = recentRPEs.length >= FATIGUE_WINDOW - 1 && recentRPEs.every(r => r >= FATIGUE_RPE_THRESHOLD);

  function buildSession(workoutKey, overrides, selections, isDeload) {
    const workoutEmphasis = wEmphasis[workoutKey] || WORKOUTS[workoutKey].defaultEmphasis;
    const workout = WORKOUTS[workoutKey];
    const exerciseIds = workout.slots.map((slot, i) => selections?.[i] || slot.primary);
    const exercises = exerciseIds.map(id => {
      const config = EXERCISES[id];
      const dupState = dup[id] || { hW: config.hW, sW: config.sW, hStalls: 0, sStalls: 0, nextType: "hypertrophy" };
      // TRUE DUP: each exercise's track comes from its own nextType, not the workout label.
      // A manual override (from the emphasis toggle) still wins if present.
      const effectiveEmphasis = overrides[id] || dupState.nextType || workoutEmphasis;
      const isHyp = effectiveEmphasis === "hypertrophy";
      const storedWeight = isHyp ? dupState.hW : dupState.sW;
      // Finding A: if this track is stale, derive a sensible load-in from the active track.
      const derivation = isDeload ? null : deriveStaleWeight(id, effectiveEmphasis, dupState, history);
      const workingWeight = derivation ? derivation.weight : storedWeight;
      const weight = isDeload ? roundToIncrement(storedWeight * 0.6, config.inc || 5) : workingWeight;
      const targetReps = isHyp ? config.repMax : config.sRepMax;
      const repMin = isHyp ? config.repMin : config.sRepMin;

      // Pull last-session data from the SAME track only, so hyp reads hyp and str reads str.
      let lastWeight = null, lastSets = null;
      for (let i = history.length - 1; i >= 0; i--) {
        const found = history[i].exercises?.find(ex => ex.id === id && ex.sessionType === effectiveEmphasis);
        if (found) { lastWeight = found.weight; lastSets = found.sets; break; }
      }

      return {
        id, name: config.name, note: config.note, bar: config.bar,
        weight, workingWeight, isDeload: !!isDeload,
        derivedWeight: !!derivation, derivationNote: derivation?.note || null,
        targetReps, repMin, sessionType: effectiveEmphasis,
        rest: isHyp ? 90 : 180,
        lastWeight, lastSets,
        stalls: isHyp ? dupState.hStalls : dupState.sStalls,
        stallN: config.stallN,
        sets: Array.from({ length: config.sets }, (_, setIdx) => ({
          reps: lastSets?.[setIdx]?.reps || String(targetReps),
          completed: false,
        })),
      };
    });

    const initAcc = suggested.map(id => {
      const acc = ACCESSORIES.find(a => a.id === id);
      const prev1 = getAccessoryLastValues(history)[id] || {};
      return { id, name: acc.name, sets: prev1.sets || "3", reps: prev1.reps || "10", weight: prev1.weight || "", done: false };
    });
    setAccItems(initAcc);
    setEmphasisOvr(overrides);
    return exercises;
  }

  function startSession(workoutKey, isDeload) {
    const defaultSelections = {};
    setSlotSelections(defaultSelections);
    const exercises = buildSession(workoutKey, {}, defaultSelections, isDeload);
    setRpe(null);
    setNote("");
    setSessStart(Date.now());
    setElapsed(0);
    setResets([]);
    setSession({
      workout: workoutKey,
      label: WORKOUTS[workoutKey].label + (isDeload ? " (Deload)" : ""),
      isDeload: !!isDeload,
      exercises,
      date: new Date().toISOString(),
      emphasis: wEmphasis[workoutKey] || WORKOUTS[workoutKey].defaultEmphasis,
    });
    setView("log");
  }

  function startAccessorySession() {
    setSlotSelections({});
    setEmphasisOvr({});
    setAccItems([]); // start empty; user adds what they want
    setRpe(null);
    setNote("");
    setSessStart(Date.now());
    setElapsed(0);
    setResets([]);
    setSession({
      workout: "ACC",
      label: "Accessory Session",
      exercises: [], // no compound exercises, never touches DUP
      date: new Date().toISOString(),
      emphasis: null,
    });
    setView("log");
  }

  function swapExercise(slotIdx, newExerciseId) {
    if (!session) return;
    const newSelections = { ...slotSelections, [slotIdx]: newExerciseId };
    setSlotSelections(newSelections);
    const exercises = buildSession(session.workout, emphasisOvr, newSelections, session.isDeload);
    setSession(prev => ({
      ...prev,
      exercises: exercises.map((ex, i) => {
        // Preserve sets data for slots that didn't change
        if (prev.exercises[i]?.id === ex.id) {
          return { ...ex, sets: prev.exercises[i].sets };
        }
        return ex; // New exercise gets fresh sets
      }),
    }));
  }

  function recoverSession(recoveredData) {
    setSession(recoveredData.session);
    setAccItems(recoveredData.accItems || []);
    setRpe(recoveredData.rpe || null);
    setNote(recoveredData.note || "");
    setEmphasisOvr(recoveredData.emphasisOvr || {});
    setSlotSelections(recoveredData.slotSelections || {});
    setAccMode(recoveredData.accMode || "quick");
    // Calculate elapsed from wall clock
    const realElapsed = Math.floor((Date.now() - recoveredData.sessStart) / 1000);
    setSessStart(recoveredData.sessStart);
    setElapsed(realElapsed);
    setResets([]);
    setRecoveredSession(null);
    setView("log");
  }

  function toggleOverride(exerciseId) {
    const current = emphasisOvr[exerciseId];
    const workoutEmphasis = wEmphasis[session?.workout] || WORKOUTS[session?.workout || "A"].defaultEmphasis;
    const next = current ? null : (workoutEmphasis === "hypertrophy" ? "strength" : "hypertrophy");
    const newOverrides = { ...emphasisOvr, [exerciseId]: next };
    setEmphasisOvr(newOverrides);
    if (session) {
      const exercises = buildSession(session.workout, newOverrides, slotSelections, session.isDeload);
      setSession(prev => ({
        ...prev,
        exercises: exercises.map((ex, i) => ({ ...ex, sets: prev.exercises[i]?.sets || ex.sets })),
      }));
    }
  }

  function saveSession() {
    try {
      clearInterval(timerRef.current);
      const rawDuration = Math.floor((Date.now() - sessStart) / 60000);
      // P2-2: cap at 180 min; a session running longer almost certainly means the
      // timer kept going while backgrounded. Record the cap rather than garbage.
      const duration = rawDuration > 180 ? 180 : rawDuration;

      // Accessory session: no compound exercises, no DUP progression, no A/B rotation change
      if (session.workout === "ACC") {
        const fullSession = { ...session, rpe, note, duration, accessories: accItems, exercises: [] };
        saveHistory([...history, fullSession]);
        clearActiveSession();
        setSaved(true);
        setTimeout(() => { setSaved(false); setSession(null); setView("home"); }, 1400);
        return;
      }

      // Ghost-session handling now lives in the unified save summary dialog (Item 1).

      // Deload session: save to history for the record, but do NOT run progression
      // or overwrite working weights. Working weight is preserved for next week.
      if (session.isDeload) {
        const fullSession = { ...session, rpe, note, duration, accessories: accItems };
        saveHistory([...history, fullSession]);
        saveNextWorkout(session.workout === "A" ? "B" : "A");
        clearActiveSession();
        setSaved(true);
        setTimeout(() => { setSaved(false); setSession(null); setView("home"); }, 1400);
        return;
      }

      const fullSession = { ...session, rpe, note, duration, accessories: accItems };
      const newHistory = [...history, fullSession];
      const newDup = applyDUPProgression(dup, session.exercises, history);
      const newNextWorkout = session.workout === "A" ? "B" : "A";

      const resetNotifications = [];
      session.exercises.forEach(exercise => {
        const oldState = dup[exercise.id];
        const newState = newDup[exercise.id];
        if (!oldState || !newState) return; // skip exercises with no prior dup state
        const sessionType = exercise.sessionType;
        if (sessionType === "hypertrophy" && newState.hW < oldState.hW) {
          resetNotifications.push(`${exercise.name} (hyp): reset to ${newState.hW}lb`);
        }
        if (sessionType === "strength" && newState.sW < oldState.sW) {
          resetNotifications.push(`${exercise.name} (str): reset to ${newState.sW}lb`);
        }
      });

      saveHistory(newHistory);
      saveDup(newDup);
      saveNextWorkout(newNextWorkout);
      clearActiveSession();

      if (resetNotifications.length) {
        setResets(resetNotifications);
      } else {
        setSaved(true);
        setTimeout(() => { setSaved(false); setSession(null); setView("home"); }, 1400);
      }
    } catch (err) {
      console.error("saveSession failed:", err);
      setAppAlert("Save failed: " + (err?.message || "unknown error") + ". Your session is still active — nothing was lost.");
    }
  }

  function handleNavigation(targetView) {
    if (session && targetView !== "log") {
      setNavGuard(targetView);
      return;
    }
    if (targetView === "log" && !session) {
      startSession(nextWorkout);
    } else {
      setView(targetView);
    }
  }

  function addAccessory(id) {
    if (accItems.find(acc => acc.id === id)) return;
    const acc = ACCESSORIES.find(a => a.id === id);
    const prev1 = accLastValues[id] || {};
    setAccItems(prev => [...prev, {
      id, name: acc.name,
      sets: prev1.sets || "3",
      reps: prev1.reps || "10",
      weight: prev1.weight || "",
      done: false,
    }]);
    setShowAccPicker(false);
  }

  function loadAccessoryTemplate(ids) {
    const newItems = ids
      .filter(id => !accItems.find(a => a.id === id))
      .map(id => {
        const acc = ACCESSORIES.find(a => a.id === id);
        const prev1 = accLastValues[id] || {};
        return {
          id, name: acc.name,
          sets: prev1.sets || "3",
          reps: prev1.reps || "10",
          weight: prev1.weight || "",
          done: false,
        };
      });
    setAccItems(prev => [...prev, ...newItems]);
    setShowTemplatePicker(false);
  }

  function handleEditSave(index, updatedSession) {
    updateHistorySession(index, updatedSession);
    setEditingSession(null);
  }

  function handleDeleteSession(index) {
    deleteHistorySession(index);
    setEditingSession(null);
  }

  function handleImport(data) {
    if (data.sessions) saveHistory(data.sessions);
    if (data.dupState) saveDup({ ...initializeDUP(), ...data.dupState });
    if (data.measurements) {
      storageSet(STORAGE_KEYS.measurements, data.measurements);
    }
    if (data.bwHistory) {
      storageSet(STORAGE_KEYS.bw, data.bwHistory);
    }
    setShowImport(false);
    window.location.reload();
  }

  function handleExport() {
    const payload = {
      schemaVersion: 2,
      exportDate: new Date().toISOString(),
      sessions: history,
      dupState: dup,
      bwHistory,
      measurements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `compound-tracker-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-950 text-white text-sm">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white max-w-lg mx-auto pb-24">
      {/* Modals */}
      {showTimer && <RestTimer defaultSecs={restSecs} onClose={() => setShowTimer(false)} />}
      {showPlates && session && <PlateCalculator exercises={session.exercises} onClose={() => setShowPlates(false)} />}
      {showBW && <BodyweightModal onSave={(w) => { const r = saveBW(w); if (r && r.ok) setShowBW(false); return r; }} onClose={() => setShowBW(false)} lastWeight={bwHistory[bwHistory.length - 1]?.weight} />}
      {showMeasurements && <MeasurementsModal onSave={(entry) => { saveMeasurements(entry); setShowMeasurements(false); }} onClose={() => setShowMeasurements(false)} lastEntry={measurements[measurements.length - 1]} />}
      {showAccPicker && <AccessoryPicker accItems={accItems} lastDone={lastDone} onAdd={addAccessory} onClose={() => setShowAccPicker(false)} />}
      {showTemplatePicker && <AccessoryTemplatePicker templates={customTemplates} onSelect={loadAccessoryTemplate} onClose={() => setShowTemplatePicker(false)} />}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}

      {editingSession !== null && (
        <SessionEditor
          session={history[editingSession]}
          index={editingSession}
          onSave={handleEditSave}
          onDelete={handleDeleteSession}
          onClose={() => setEditingSession(null)}
        />
      )}

      {/* Recovery dialog */}
      {recoveredSession && !session && (
        <RecoveryDialog
          sessionData={recoveredSession}
          onRecover={() => recoverSession(recoveredSession)}
          onDiscard={() => { setRecoveredSession(null); clearActiveSession(); }}
        />
      )}

      {/* Item 1: unified save summary — one dialog instead of three stacked */}
      {saveSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
            <div className="font-bold text-lg text-white mb-1">Complete session?</div>
            <div className="text-sm text-gray-400 mb-4">{formatSeconds(saveSummary.elapsed)} elapsed</div>

            {(saveSummary.unchecked.length > 0 || saveSummary.incompleteCats.length > 0 || saveSummary.isGhost) && (
              <div className="space-y-2 mb-4">
                {saveSummary.isGhost && (
                  <div className="flex items-start gap-2 text-xs bg-red-950 bg-opacity-40 border border-red-900 rounded-lg px-3 py-2 text-red-300">
                    <span>⚠</span><span>No sets are marked complete. You probably want to discard this instead of saving.</span>
                  </div>
                )}
                {saveSummary.unchecked.length > 0 && (
                  <div className="flex items-start gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2 text-gray-300">
                    <span className="text-amber-400">•</span>
                    <span>{saveSummary.unchecked.length} set{saveSummary.unchecked.length > 1 ? "s have" : " has"} reps typed but aren't checked — they won't count unless marked done.</span>
                  </div>
                )}
                {saveSummary.incompleteCats.length > 0 && (
                  <div className="flex items-start gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2 text-gray-300">
                    <span className="text-amber-400">•</span>
                    <span>Incomplete categories: {saveSummary.incompleteCats.join(", ")}.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {saveSummary.unchecked.length > 0 && (
                <button onClick={() => {
                  setSession(prev => ({
                    ...prev,
                    exercises: prev.exercises.map(ex => ({
                      ...ex,
                      sets: ex.sets.map(st => (!st.completed && st.reps && parseFloat(st.reps) > 0) ? { ...st, completed: true } : st),
                    })),
                  }));
                  setSaveSummary(null);
                  setTimeout(() => saveSession(), 60);
                }} className="w-full bg-green-700 text-white font-semibold py-3 rounded-xl text-sm">
                  Check those sets & save
                </button>
              )}
              <button onClick={() => { setSaveSummary(null); saveSession(); }}
                className={`w-full font-semibold py-3 rounded-xl text-sm ${saveSummary.unchecked.length > 0 ? "bg-gray-700 text-gray-200" : "bg-navy text-navy-light"}`}>
                {saveSummary.isGhost ? "Save anyway" : "Save session"}
              </button>
              {saveSummary.isGhost && (
                <button onClick={() => { setSaveSummary(null); clearActiveSession(); setSession(null); setView("home"); }}
                  className="w-full bg-red-800 text-white font-semibold py-3 rounded-xl text-sm">
                  Discard session
                </button>
              )}
              <button onClick={() => setSaveSummary(null)} className="w-full bg-gray-800 text-gray-400 font-semibold py-3 rounded-xl text-sm">
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item 2: styled alert replaces native alert() */}
      {appAlert && <AlertDialog message={appAlert} onClose={() => setAppAlert(null)} />}

      {/* Navigation guard */}
      {navGuard && (
        <ConfirmDialog
          title="Active Session"
          message="You have an in-progress workout. Leaving will discard all unsaved data."
          confirmLabel="Discard"
          danger
          onConfirm={() => { setSession(null); clearActiveSession(); setView(navGuard); setNavGuard(null); }}
          onCancel={() => setNavGuard(null)}
        />
      )}

      {/* Reset notifications */}
      {resets.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs border border-orange-700 text-center space-y-4">
            <div className="text-3xl">⚠</div>
            <div className="font-bold text-lg text-orange-400">Auto-Reset Applied</div>
            <div className="text-sm text-gray-400">Stall threshold reached:</div>
            {resets.map((reset, i) => (
              <div key={i} className="bg-gray-800 rounded-xl px-3 py-2 text-xs text-left text-orange-300">{reset}</div>
            ))}
            <div className="text-xs text-gray-500">Weights reduced to drive long-term progress.</div>
            <button onClick={() => { setResets([]); setSession(null); setView("home"); }}
              className="w-full bg-navy text-navy-light py-3 rounded-xl font-bold">Got it</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 px-4 pt-6 pb-4 border-b border-gray-800">
        <div className="flex justify-between items-start">
          <h1 className="text-xl font-bold tracking-tight">Compound Tracker</h1>
          <div className="flex gap-2 flex-wrap justify-end">
            {missed && <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded-full">{lastGap}d gap</span>}
            {streak > 0 && <span className="text-xs bg-orange-900 text-orange-300 px-2 py-1 rounded-full">🔥{streak}w</span>}
            {fatigue && <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded-full">Fatigue</span>}
          </div>
        </div>
        <div className="mt-2 flex gap-2 items-center">
          <span className="text-sm">🏋️</span>
          <span className="text-xs text-gray-500">Lift-specific progression</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="bg-gray-800 rounded-xl p-2 text-center">
            <div className="text-lg font-bold">{history.length}</div>
            <div className="text-xs text-gray-500">Sessions</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-orange-400">🔥{streak}</div>
            <div className="text-xs text-gray-500">Wk streak</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-yellow-400">{bwHistory[bwHistory.length - 1]?.weight ?? "—"}</div>
            <div className="text-xs text-gray-500">BW (lb)</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900">
        {["home", "log", "history", "progress"].map(tab => {
          const isLogDisabled = tab === "log" && !session;
          return (
            <button key={tab}
              onClick={() => { if (!isLogDisabled) handleNavigation(tab); }}
              disabled={isLogDisabled}
              className={`flex-1 py-2.5 text-xs font-medium capitalize ${
                tab === view ? "border-b-2 border-navy text-white"
                : isLogDisabled ? "text-gray-700"
                : "text-gray-500"
              }`}>
              {tab === "home" ? "Home" : tab === "log" ? (session ? "Log ●" : "Log") : tab === "history" ? "History" : "Progress"}
            </button>
          );
        })}
      </div>

      {/* Views */}
      {view === "home" && (
        <HomeView
          dup={dup} history={history} bwHistory={bwHistory} nextWorkout={nextWorkout}
          prs={prs} streak={streak} missed={missed} lastGap={lastGap} fatigue={fatigue}
          wEmphasis={wEmphasis} setWEmphasis={setWEmphasis}
          onStartSession={startSession} onStartAccessory={startAccessorySession} onLogBW={() => setShowBW(true)}
          onLogMeasurements={() => setShowMeasurements(true)}
        />
      )}

      {view === "log" && (
        <LogView
          session={session} setSession={setSession} elapsed={elapsed}
          prs={prs} emphasisOvr={emphasisOvr} settings={settings}
          accItems={accItems} setAccItems={setAccItems}
          rpe={rpe} setRpe={setRpe} note={note} setNote={setNote}
          suggested={suggested} lastDone={lastDone} accLastValues={accLastValues} onNotify={(msg) => setAppAlert(msg)} customTemplates={customTemplates}
          onToggleOverride={toggleOverride} onSwapExercise={swapExercise}
          onSave={() => {
            if (!session) return;
            // Item 1: compute one summary instead of stacking dialogs.
            const uncheckedWithReps = [];
            (session.exercises || []).forEach(ex => {
              ex.sets.forEach((st, i) => {
                if (!st.completed && st.reps && parseFloat(st.reps) > 0) {
                  uncheckedWithReps.push({ exId: ex.id, name: ex.name, setIdx: i });
                }
              });
            });
            let incompleteCats = [];
            if (session.workout !== "ACC") {
              const reqCats = getRequiredCategories(session.workout);
              const catStatus = checkCategoryCompletion(reqCats, accItems);
              incompleteCats = catStatus.filter(c => !c.completed).map(c => c.label);
            }
            const anyCompleted = (session.exercises || []).some(ex => (ex.sets || []).some(st => st.completed));
            setSaveSummary({
              unchecked: uncheckedWithReps,
              incompleteCats,
              elapsed,
              isGhost: session.workout !== "ACC" && !anyCompleted,
            });
          }}
          onShowPlates={() => setShowPlates(true)}
          onShowTimer={(secs) => { setRestSecs(secs); setShowTimer(true); }}
          onShowAccPicker={() => setShowAccPicker(true)}
          onShowTemplatePicker={() => setShowTemplatePicker(true)}
          accMode={accMode} setAccMode={setAccMode} saved={saved}
        />
      )}

      {view === "history" && (
        <HistoryView history={history} onEdit={(idx) => setEditingSession(idx)} />
      )}

      {view === "progress" && (
        <ProgressView
          history={history} dup={dup} prs={prs} bwHistory={bwHistory}
          measurements={measurements}
          selEx={selEx} setSelEx={setSelEx}
          onExport={handleExport} onShowImport={() => setShowImport(true)}
        />
      )}
    </div>
  );
}
