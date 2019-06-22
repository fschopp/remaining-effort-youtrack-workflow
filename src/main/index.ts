// tslint:disable-next-line:no-reference
/// <reference path="youtrack-scripting-api.d.ts"/>
import { Period, toPeriod } from '@jetbrains/youtrack-scripting-api/date-time';
import { Field, Issue, PeriodFieldName, Project, Set } from '@jetbrains/youtrack-scripting-api/entities';

const REMAINING_EFFORT_NAME: PeriodFieldName = 'Remaining effort';

/**
 * Returns the minutes per week that are work time, according to the time tracking settings of the YouTrack project.
 */
function workMinutesPerWeek(project: Project): number {
  // The dates are basically arbitrary, just one week apart. This ticket has more information about the return value of
  // Project#intervalToWorkingMinutes():
  // https://youtrack.jetbrains.com/issue/JT-47322
  return project.intervalToWorkingMinutes(Date.UTC(2019, 1, 2), Date.UTC(2019, 1, 9));
}

/**
 * Returns the number of minutes in the given period, or null if no period is given.
 */
function periodToMinutes(period: Period | null, project: Project) {
  if (!period) {
    return null;
  }

  const workHoursPerDay = project.intervalToWorkingMinutes(
    Date.UTC(2019, 1, 2), Date.UTC(2019, 1, 3)) / 60;
  const workDaysPerWeek = workMinutesPerWeek(project) / (60 * workHoursPerDay);
  return (((((
    period.getWeeks() * workDaysPerWeek) +
    period.getDays()) * workHoursPerDay) +
    period.getHours()) * 60) +
    period.getMinutes();
}

/**
 * Returns the sum of the given arguments, or null if both are null. If only one argument is null, returns the other.
 */
function addPreservingNull(left: number | null, right: number | null): number | null {
  // Due to JavaScript coercion rules, the following is equivalent to the following JavaScript:
  // return (left === null && right === null) ? null : left + right;
  // But the following is more readable:
  if (left === null && right === null) {
    return null;
  } else if (left === null) {
    return right;
  } else if (right === null) {
    return left;
  } else {
    return left + right;
  }
}

/**
 * Returns the sum, over all sub-issues, of the given period field. Two values are returned, one before and one after
 * the transaction.
 *
 * Either one of the two returned values may be null if the field has (or had, respectively) no value for the issue and
 * all its subissues.
 */
function sumTime(parentIssue: Issue, periodFieldName: PeriodFieldName, project: Project):
    {newMinutes: number | null, oldMinutes: number | null} {
  const oldSubtasksMap: Record<string, Issue> = {};

  let newMinutes: number | null = null;
  const children: Set<Issue> = parentIssue.links['parent for'];
  children.forEach((child: Issue) => {
    const period: Period | null = child.fields[periodFieldName];
    newMinutes = addPreservingNull(
      newMinutes,
      periodToMinutes(period, project)
    );
    oldSubtasksMap[child.id] = child;
  });
  children.added.forEach((child: Issue) => delete oldSubtasksMap[child.id]);
  children.removed.forEach((child: Issue) => oldSubtasksMap[child.id] = child);

  let oldMinutes = null;
  for (const id of Object.keys(oldSubtasksMap)) {
    const child: Issue = oldSubtasksMap[id];
    oldMinutes = addPreservingNull(
      oldMinutes,
      periodToMinutes(child.fields.oldValue(periodFieldName), project)
    );
  }

  return {
    oldMinutes,
    newMinutes,
  };
}

/**
 * Sets the remaining effort for the given issue.
 */
function setRemainingEffort(issue: Issue, minutes: number | null) {
  // Very annoying that we cannot rely on RemainingDuration being updated
  // automatically. We need to call setRemainingDuration() due to:
  // https://youtrack.jetbrains.com/issue/JT-52086
  if (minutes === null) {
    issue.fields[REMAINING_EFFORT_NAME] = null;
  } else {
    issue.fields[REMAINING_EFFORT_NAME] = toPeriod(minutes * 60 * 1000);
  }
}

export const rule = Issue.onChange({
  title: `Update '${REMAINING_EFFORT_NAME}' on change of subissues`,
  guard(ctx) {
    const issue: Issue = ctx.issue;
    return issue.links['subtask of'].isChanged || ctx.issue.fields.isChanged(ctx.RemainingEffort.name);
  },
  action(ctx) {
    const project: Project = ctx.issue.project;
    const parents: Set<Issue> = ctx.issue.links['subtask of'];

    function parentUpdateFunction(parent: Issue) {
      const timeSum = sumTime(parent, ctx.RemainingEffort.name, project);
      const parentPreviousEffort: number | null = periodToMinutes(parent.fields[ctx.RemainingEffort.name], project);
      if (parentPreviousEffort === null || parentPreviousEffort === timeSum.oldMinutes) {
        setRemainingEffort(parent, timeSum.newMinutes);
      }
    }

    // If the user manually sets the remaining effort to a falsy value, then
    // recompute this field from the sub-issues.
    if (ctx.issue.fields.isChanged(ctx.RemainingEffort.name) && ctx.issue.fields[ctx.RemainingEffort.name] === null) {
      const newMinutes = sumTime(ctx.issue, ctx.RemainingEffort.name, project).newMinutes;
      setRemainingEffort(ctx.issue, newMinutes);
    }

    parents.removed.forEach(parentUpdateFunction);
    parents.forEach(parentUpdateFunction);
  },
  requirements: {
    RemainingEffort: {
      type: Field.periodType,
      name: REMAINING_EFFORT_NAME,
    },
  },
});
