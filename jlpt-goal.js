// A duration counts local calendar days, including the day the goal was set.
export const goalKey = "echo-jlpt-goal-v1";
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
