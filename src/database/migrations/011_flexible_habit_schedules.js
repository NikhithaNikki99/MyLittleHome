// Flexible habit schedules. The weekday schedule (habit_schedule_days) and every habit_logs row are untouched:
// existing habits become schedule_type 'weekdays' and behave exactly as before. The other types keep their
// settings on the habit row itself:
//   interval      every interval_days days, counted from start_date
//   weekly_count  weekly_target completed days in any Monday-Sunday week (6 at most; 7 would be "every day")
//   monthly_day   once a month on month_day (the last day of the month when the month is shorter)
// Habits that are not 'weekdays' have no habit_schedule_days rows.
// The one CHECK on month_day (the last column added, so it can see the others) ties each type to its setting.
export default {
  version: 11,
  name: 'flexible_habit_schedules',
  sql: `
    ALTER TABLE habits ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'weekdays'
      CHECK (schedule_type IN ('weekdays', 'interval', 'weekly_count', 'monthly_day'));
    ALTER TABLE habits ADD COLUMN interval_days INTEGER
      CHECK (interval_days IS NULL OR interval_days BETWEEN 2 AND 365);
    ALTER TABLE habits ADD COLUMN weekly_target INTEGER
      CHECK (weekly_target IS NULL OR weekly_target BETWEEN 1 AND 6);
    ALTER TABLE habits ADD COLUMN month_day INTEGER
      CHECK (
        (month_day IS NULL OR month_day BETWEEN 1 AND 31)
        AND ((schedule_type = 'interval') = (interval_days IS NOT NULL))
        AND ((schedule_type = 'weekly_count') = (weekly_target IS NOT NULL))
        AND ((schedule_type = 'monthly_day') = (month_day IS NOT NULL))
      );
  `,
};
