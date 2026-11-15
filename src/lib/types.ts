export type ISODate = string; // YYYY-MM-DD, local calendar date
export type Priority = 'low' | 'normal' | 'high';

export type Repeat =
  | { every: 'day' }
  | { every: 'weekday' }
  | { every: 'week'; weekdays: number[] } // 0 = Sunday … 6 = Saturday
  | { every: 'month' };

/** What the quick-add parser (or the AI) extracts from one sentence. */
export interface TaskDraft {
  title: string;
  due?: ISODate;
  time?: string; // HH:mm, 24-hour
  durationMin?: number;
  priority: Priority;
  tags: string[];
  repeat?: Repeat;
}

export interface Task extends TaskDraft {
  id: string;
  notes?: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
  goalId?: string;
  /** Set when a reminder is scheduled on the device. */
  notificationId?: string;
}

export interface Goal {
  id: string;
  title: string;
  deadline?: ISODate;
  createdAt: string;
  /** "ai" when the steps came from the language model, "quick" for the offline planner. */
  plannedBy: 'ai' | 'quick';
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
