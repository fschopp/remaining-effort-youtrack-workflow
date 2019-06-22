// This import is needed for mocking module '@jetbrains/youtrack-scripting-api/entities', so it needs to come first!
import { MockIssue } from '../mocks/mock-issue';

import { Period } from '@jetbrains/youtrack-scripting-api/date-time';
import {
  ActionFunctionContext,
  FieldName,
  Fields,
  GuardFunctionContext,
  Issue,
  Project,
  RuleProperties,
  Set,
} from '@jetbrains/youtrack-scripting-api/entities';
import { strict as assert } from 'assert';
import '../main/youtrack-scripting-api.d';


jest.mock('@jetbrains/youtrack-scripting-api/entities', () => ({
  Field: {
    periodType: 'whatever',
  },
  Issue: MockIssue,
}));
jest.mock('@jetbrains/youtrack-scripting-api/date-time', () => ({
  toPeriod(period: number | string): Period {
    if (typeof period === 'string') {
      throw new Error('Mock implementation does not support conversion from string.');
    }
    // Period is in ms.
    return toPeriodFromMinutes(Math.floor(period / (60 * 1000)))!;
  },
}));

type Context = GuardFunctionContext & ActionFunctionContext & ReturnType<typeof requirements>;

function requirements() {
  return {
    RemainingEffort: {
      type: 'whatever',
      name: 'Remaining effort',
    },
  };
}

describe('workflow is properly defined', () => {
  let ruleProperties: RuleProperties<ReturnType<typeof requirements>>;

  beforeAll(() => {
    MockIssue.onChange.mockReset();
    jest.isolateModules(() => {
      require('../main');
    });
    expect(MockIssue.onChange).toHaveBeenCalledTimes(1);

    ruleProperties = MockIssue.onChange.mock.calls[0][0];
    expect(ruleProperties.title).toEqual("Update 'Remaining effort' on change of subissues");
    expect(ruleProperties.requirements).toEqual(requirements());
  });

  afterAll(() => {
    MockIssue.onChange.mockReset();
  });

  test.each([
    [
      {},
      false,
    ],
    [
      {
        remainingEffortMin: 2,
        oldRemainingEffortMin: 1,
      },
      true,
    ],
    [
      {
        remainingEffortMin: 2,
        oldRemainingEffortMin: 2,
      },
      false,
    ],
    [
      {
        children: [{
          isAdded: true,
          remainingEffortMin: 1,
          oldRemainingEffortMin: 1,
        }, {
          remainingEffortMin: 1,
          oldRemainingEffortMin: 1,
        }],
        remainingEffortMin: 1,
        oldRemainingEffortMin: 1,
      },
      // The event is triggered on the issue that gets a new parent issue, not the issue getting a new subissue
      false,
    ],
  ] as [DataIssue, boolean][])('guard(%j) returns %s', (dataIssue: DataIssue, result: boolean) => {
    expect(ruleProperties.guard(new ContextBuilder(dataIssue).context)).toEqual(result);
  });

  test('update remaining effort of parent if previously synchronized', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        remainingEffortMin: 4,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
      remainingEffortMin: 5,
      oldRemainingEffortMin: 5,
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(7);
  });

  test('do not update remaining effort of parent if not previously synchronized', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        remainingEffortMin: 4,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
      remainingEffortMin: 10,
      oldRemainingEffortMin: 10,
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(10);
  });

  test('set remaining effort of parent if it was previously null', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        remainingEffortMin: 4,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(7);
  });

  test('recompute when set to null', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        remainingEffortMin: 2,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
      remainingEffortMin: undefined,
      // Before the transaction, there was no synchronization.
      oldRemainingEffortMin: 0,
    };
    const contextBuilder: ContextBuilder = new ContextBuilder(parentDataIssue);
    const parentContext: Context = contextBuilder.context;
    const idToIssueMap: Map<string, Issue> = contextBuilder.idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const guardResult: boolean = ruleProperties.guard(parentContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(parentContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(5);
  });

  test('set remaining effort of parent to null if previously synchronized and all subissues become null', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        remainingEffortMin: undefined,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: undefined,
        oldRemainingEffortMin: undefined,
      }],
      remainingEffortMin: 2,
      oldRemainingEffortMin: 2,
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(null);
  });

  test('recompute when subissue removed and previously synchronized', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        isRemoved: true,
        remainingEffortMin: 2,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
      remainingEffortMin: 5,
      oldRemainingEffortMin: 5,
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(3);
  });

  test('recompute when subissue removed and not previously synchronized', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        isRemoved: true,
        remainingEffortMin: 2,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
      remainingEffortMin: 10,
      oldRemainingEffortMin: 10,
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(10);
  });

  test('recompute when subissue added and previously synchronized', () => {
    const parentDataIssue: DataIssue = {
      children: [{
        isAdded: true,
        remainingEffortMin: 2,
        oldRemainingEffortMin: 2,
      }, {
        remainingEffortMin: 3,
        oldRemainingEffortMin: 3,
      }],
      remainingEffortMin: 3,
      oldRemainingEffortMin: 3,
    };
    const idToIssueMap: Map<string, Issue> = new ContextBuilder(parentDataIssue).idToIssueMap;
    const parentIssue: Issue = idToIssueMap.get('XYZ-0')!;
    const childIssue: Issue = idToIssueMap.get('XYZ-1')!;
    const childContext: Context = {
      ...requirements(),
      issue: childIssue,
    };
    const guardResult: boolean = ruleProperties.guard(childContext);
    expect(guardResult).toBeTruthy();
    ruleProperties.action(childContext);
    expect(toMinutes(parentIssue.fields['Remaining effort'])).toEqual(5);
  });
});

interface DataIssue {
  children?: DataIssue[];
  isAdded?: boolean;
  isRemoved?: boolean;
  remainingEffortMin?: number;
  oldRemainingEffortMin?: number;
}

class ContextBuilder {
  public readonly context: Context;
  public readonly idToIssueMap = new Map<string, Issue>();
  private readonly project: Project = {
    intervalToWorkingMinutes(start: number, end: number): number {
      if (end - start === 24 * 60 * 60 * 1000) {
        return 8 * 60;
      } else if (end - start === 7 * 24 * 60 * 60 * 1000) {
        return 5 * 8 * 60;
      } else {
        throw new Error('Only intervals of one day or one week are supported.');
      }
    },
  };

  constructor(issue: DataIssue) {
    this.context = {
      ...requirements(),
      issue: this.issueFor(issue),
    };
  }

  private issueFor(dataIssue: DataIssue, parent?: Issue): Issue {
    const emptySet: Set<Issue> = {} as Set<Issue>;

    const id: string = `XYZ-${this.idToIssueMap.size}`;
    assert(!this.idToIssueMap.has(id), 'Generated id is not unique.');

    const issue: Issue = {
      id,
      fields: this.fieldsFor(dataIssue),
      links: {
        'parent for': emptySet,
        'subtask of': emptySet,
      },
      project: this.project,
    };
    this.idToIssueMap.set(id, issue);

    issue.links['parent for'] = this.setOfChildrenFor(dataIssue.children, issue);
    issue.links['subtask of'] = this.setOfParentsFor(dataIssue, parent);
    return issue;
  }

  private fieldsFor(issue: DataIssue): Fields {
    return {
      isChanged(field: FieldName): boolean {
        expect(field).toEqual('Remaining effort');
        return issue.remainingEffortMin !== issue.oldRemainingEffortMin;
      },
      oldValue<T extends FieldName>(field: T): Fields[T] {
        expect(field).toEqual('Remaining effort');
        return toPeriodFromMinutes(issue.oldRemainingEffortMin);
      },
      'Remaining effort': toPeriodFromMinutes(issue.remainingEffortMin),
    };
  }

  private setOfChildrenFor(dataIssues: DataIssue[] | undefined, parent: Issue): Set<Issue> {
    const issues: Issue[] = [];
    const addedIssues: Issue[] = [];
    const removedIssues: Issue[] = [];

    if (dataIssues !== undefined) {
      for (const dataIssue of dataIssues) {
        const issue = this.issueFor(dataIssue, parent);
        if (!dataIssue.isRemoved) {
          issues.push(issue);
        }
        if (dataIssue.isAdded) {
          addedIssues.push(issue);
        }
        if (dataIssue.isRemoved) {
          removedIssues.push(issue);
        }
      }
    }
    return createSet(issues, addedIssues, removedIssues);
  }

  private setOfParentsFor(dataIssue: DataIssue, parent?: Issue): Set<Issue> {
    if (dataIssue.isAdded && dataIssue.isRemoved) {
      throw new Error('Element cannot be added and removed in the same transaction.');
    }

    const getParent = (): Issue => parent === undefined
        ? this.issueFor({})
        : parent;
    if (dataIssue.isAdded) {
      // We pretend the issue had no parent before the transaction.
      const currentParent = getParent();
      return createSet([currentParent], [currentParent], []);
    } else if (dataIssue.isRemoved) {
      // We pretend the issue will have no parent after the transaction.
      const currentParent = getParent();
      return createSet([], [], [currentParent]);
    } else if (parent !== undefined) {
      return createSet([parent], [], []);
    } else {
      return createSet([], [], []);
    }
  }
}

function syntheticSet(issues: Issue[]): Set<Issue> {
  // We deliberately leave all other properties undefined, because accessing those should cause an error.
  return {
    forEach(visitor: (element: Issue) => void): void {
      issues.forEach(visitor);
    },
  } as Set<Issue>;
}

function createSet(issues: Issue[], addedIssues: Issue[], removedIssues: Issue[]): Set<Issue> {
  return {
    added: syntheticSet(addedIssues),
    forEach(visitor: (element: Issue) => void): void {
      issues.forEach(visitor);
    },
    isChanged: addedIssues.length > 0 || removedIssues.length > 0,
    removed: syntheticSet(removedIssues),
  };
}

function toPeriodFromMinutes(totalMinutes?: number): Period | null {
  if (totalMinutes === undefined) {
    return null;
  }

  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 60;
  const totalDays = Math.floor(totalHours / 8);
  const days = totalDays % 8;
  const totalWeeks = Math.floor(totalDays / 5);

  return {
    getWeeks: () => totalWeeks,
    getDays: () => days,
    getHours: () => hours,
    getMinutes: () => minutes,
  };
}

function toMinutes(period: Period | null): number | null {
  return period === null
    ? null
    : ((period.getWeeks() * 5 + period.getDays()) * 8 + period.getHours()) * 60 + period.getMinutes();
}
