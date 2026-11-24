// A duration counts local calendar days, including the day the goal was set.
export const goalKey = "echo-jlpt-goal-v1";
// When the goal was last saved, so the newer goal wins between devices (sync.js).
export const goalAtKey = "echo-jlpt-goal-at";
export function writeGoal(value, now = new Date()) {
  if (value) localStorage.setItem(goalKey, JSON.stringify(value)); else localStorage.removeItem(goalKey);
  localStorage.setItem(goalAtKey, now.toISOString());
  try { globalThis.dispatchEvent?.(new CustomEvent("echo:goal-saved")); } catch {}
}
export function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
export function parseGoalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value+"T00:00:00");
  return dateKey(date) === value ? date : null;
}
export function readGoal() {
  try {
    const goal = JSON.parse(localStorage.getItem(goalKey));
    return goal && parseGoalDate(goal.exam) && parseGoalDate(goal.started) &&
      (goal.days === null || (Number.isInteger(goal.days) && goal.days > 0 && goal.days <= 3650)) ? goal : null;
  } catch { return null; }
}
export function firstPassEnd(goal) {
  if (goal.days === null) return null;
  const end = parseGoalDate(goal.started);
  end.setDate(end.getDate() + goal.days - 1);
  const exam = parseGoalDate(goal.exam);
  return end < exam ? end : exam;
}
export function reviewFocus(goal, now = new Date()) {
  return goal?.priority === true && dateKey(now) <= goal.exam;
}
// Calendar dates as the plan says them: "Sun 6 Dec", "Sunday 6 December".
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const shortDate = d => DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);
export const longDate = d => DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
