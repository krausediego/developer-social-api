type StreakResult = {
  currentStreak: number;
  longestStreak: number;
};

const DAY_IN_MS = 86_400_00;

function toDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MS);
}

export function calculateStreaks(dates: string[], today: string): StreakResult {
  const days = [...new Set(dates.map(toDayNumber))].sort((a, b) => a - b);

  if (days.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  let longestStreak = 1;
  let streak = 1;

  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] + 1) {
      streak++;
    } else {
      streak = 1;
    }

    longestStreak = Math.max(longestStreak, streak);
  }

  const todayNumber = toDayNumber(today);
  const lastDay = days.at(-1);

  let currentStreak = 0;

  if (lastDay === todayNumber || lastDay === todayNumber - 1) {
    currentStreak = 1;

    for (let i = days.length - 1; i > 0; i--) {
      if (days[i] === days[i - 1] + 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
  };
}
