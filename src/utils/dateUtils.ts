import { DateTime } from 'luxon';

/**
 * Get the current ISO week in format YYYY-WW
 */
export const getCurrentISOWeek = (): string => {
  const now = DateTime.now();
  const year = now.weekYear;
  const week = now.weekNumber.toString().padStart(2, '0');
  return `${year}-${week}`;
};

/**
 * Calculate progress based on current week and duration
 */
export const calculateProgressWithDuration = (weekStr: string | null | undefined, duration: number | null | undefined): number => {
  if (!weekStr || !duration) return 0;
  
  try {
    // Parse the week string
    const [year, week] = weekStr.split('-').map(Number);
    
    // Get current week info
    const now = DateTime.now();
    const currentYear = now.weekYear;
    const currentWeek = now.weekNumber;
    
    // Calculate total weeks in the duration
    const startDate = DateTime.fromObject({ weekYear: year, weekNumber: week });
    const endDate = startDate.plus({ weeks: duration - 1 }); // -1 because duration includes start week
    
    // If the goal is in the future, return 0%
    if (startDate > now) return 0;
    
    // If the goal is in the past, return 100%
    if (endDate < now) return 100;
    
    // Calculate elapsed weeks
    const totalWeeks = duration;
    const elapsedWeeks = currentWeek - week + ((currentYear - year) * 52);
    
    // Calculate progress
    const progress = Math.min(100, Math.max(0, Math.round((elapsedWeeks / totalWeeks) * 100)));
    
    return progress;
  } catch (error) {
    console.error('Error calculating progress:', error);
    return 0;
  }
};

/**
 * Get start and end dates for a week
 */
export const getWeekInfo = (weekStr: string | null | undefined) => {
  if (!weekStr) return null;
  
  try {
    const [year, week] = weekStr.split('-').map(Number);
    
    const startDate = DateTime.fromObject({ 
      weekYear: year, 
      weekNumber: week 
    }).startOf('week');
    
    const endDate = startDate.endOf('week');
    
    return {
      startDate: startDate.toFormat('MMM d, yyyy'),
      endDate: endDate.toFormat('MMM d, yyyy')
    };
  } catch (error) {
    console.error('Error parsing week:', error);
    return null;
  }
};

/**
 * Calculate remaining time for a goal
 */
export const calculateRemainingTime = (weekStr: string | null | undefined, duration: number | null | undefined): string => {
  if (!weekStr || !duration) return '';
  
  try {
    // Parse the week string
    const [year, week] = weekStr.split('-').map(Number);
    
    // Calculate end date
    const startDate = DateTime.fromObject({ weekYear: year, weekNumber: week }).startOf('week');
    const endDate = startDate.plus({ weeks: duration }).endOf('week');
    
    // Get current date
    const now = DateTime.now();
    
    // If the goal is already past due
    if (endDate < now) {
      return 'Overdue';
    }
    
    // Calculate difference
    const diff = endDate.diff(now, ['weeks', 'days']).toObject();
    
    const weeks = Math.floor(diff.weeks || 0);
    const days = Math.floor(diff.days || 0);
    
    // Format the remaining time
    let result = '';
    if (weeks > 0) {
      result += `${weeks}W `;
    }
    if (days > 0 || result === '') {
      result += `${days}D`;
    }
    
    return result.trim();
  } catch (error) {
    console.error('Error calculating remaining time:', error);
    return '';
  }
}; 