import { createDueSessions, escalateOverdue } from '../../counts/sessions';

export const COUNT_CREATE_JOB = 'count-create-due';
export const COUNT_ESCALATE_JOB = 'count-escalate-overdue';
export const runCreateDue = () => createDueSessions();
export const runEscalate = () => escalateOverdue();
