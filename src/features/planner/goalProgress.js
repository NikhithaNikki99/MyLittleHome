// Progress is derived from milestones (done / total). A goal marked complete reads as 100% whatever its
// milestones say, and a goal with no milestones sits at 0% until it is completed by hand.
export function goalProgress({ milestoneTotal, milestoneDone, completed }) {
  if (completed) return { ratio: 1, percent: 100, label: 'Complete' };
  if (!milestoneTotal) return { ratio: 0, percent: 0, label: 'No milestones yet' };
  const done = Math.max(0, Math.min(milestoneDone, milestoneTotal));
  const ratio = done / milestoneTotal;
  return {
    ratio,
    percent: Math.round(ratio * 100),
    label: `${done} of ${milestoneTotal} ${milestoneTotal === 1 ? 'milestone' : 'milestones'}`,
  };
}
