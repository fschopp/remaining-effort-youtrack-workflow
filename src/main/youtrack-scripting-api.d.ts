declare module '@jetbrains/youtrack-scripting-api/date-time' {
  interface Period {
    getWeeks(): number;
    getDays(): number;
    getHours(): number;
    getMinutes(): number;
  }

  /**
   * Creates a period representation of an argument.
   *
   * @param period A duration in milliseconds as either a number or a string. The string representation is a series of
   *     numeric values followed by the abbreviation that represents the timespan, in descending order. For example,
   *     1m3w4d23h58m.
   * @return The period representation of the specified argument.
   */
  function toPeriod(period: number | string): Period;
}

declare module '@jetbrains/youtrack-scripting-api/entities' {
  type PeriodFieldName = 'Remaining effort';
  type FieldName = PeriodFieldName;
  type LinkTypeName = 'parent for' | 'subtask of';


  import { Period } from '@jetbrains/youtrack-scripting-api/date-time';

  /**
   * This function is called by different events depending on the rule type:
   * when a change is applied to an issue (on-change rules), when a command is executed (action rules),
   * or according to a predefined schedule (scheduled rules). This function is called separately
   * for each related issue.
   *
   * @param ctx The execution context. Along with the parameters listed below, the context also contains objects that
   *     you describe in the {@link Requirements}.
   */
  type ActionFunction<T extends Requirements> = (ctx: ActionFunctionContext & T) => void;

  interface ActionFunctionContext {
    /**
     * The current issue.
     */
    issue: Issue;
  }

  interface FieldConstructor {
    readonly periodType: string;
  }

  // tslint:disable-next-line:variable-name
  let Field: FieldConstructor;

  /**
   * Represents the custom fields that are used in an issue.
   * The actual set of custom fields that are used for each issue is configured on a per-project basis.
   * The properties shown here correspond with the default custom fields in YouTrack.
   * Additional custom fields that have been attached to a project are also available.
   */
  interface Fields {
    /**
     * Checks whether the custom field is changed in the current transaction.
     *
     * @param field The name of the custom field (for example, 'State') or a reference to the field that is checked.
     *
     * @returns If the value of the field is changed in the current transaction, returns `true`.
     */
    isChanged(field: FieldName): boolean;

    /**
     * Returns the previous value of a single-valued custom field before an update was applied. If the field is not
     * changed in the transaction, this value is equal to the current value of the field.
     *
     * @param field The name of the custom field (for example, 'State') or a reference to the field for which the
     *     previous value is returned.
     * @returns If the custom field is changed in the current transaction, the previous value of the field. Otherwise,
     *     the current value of the field.
     */
    oldValue<T extends FieldName>(field: T): Fields[T];

    'Remaining effort': Period | null;
  }

  /**
   * This function is called to determine whether an action function can be applied to an issue.
   * Guard functions are used in on-change rules, action rules, and in transitions between values of a state-machine
   * rule.
   * On-schedule rules also support guard functions, but this rule type includes a `search` property that has a similar
   * purpose.
   *
   * @param ctx The execution context. Along with the parameters listed below, the context also contains objects that
   *     you describe as {@link Requirements}.
   */
  type GuardFunction<T extends Requirements> = (ctx: GuardFunctionContext & T) => boolean;

  interface GuardFunctionContext {
    /**
     * The current issue.
     */
    issue: Issue;
  }

  interface Issue {
    /**
     * The issue ID.
     */
    readonly id: string;

    /**
     * The custom fields that are used in an issue. This is the collection of issue attributes like
     * `Assignee`, `State`, and `Priority` that are defined in the Custom Fields section of the administrative interface
     * and can be attached to each project independently.
     *
     * Issue attributes like `reporter`, `numberInProject`, and `project` are accessed directly.
     */
    fields: Fields;

    /**
     * The project to which the issue is assigned.
     */
    project: Project;

    /**
     * Issue links (e.g. `relates to`, `parent for`, etc.). Each link is a {@link Set} of {@link Issue} objects.
     */
    links: Record<LinkTypeName, Set<Issue>>;
  }

  interface IssueConstructor {
    /**
     * Creates a declaration of a rule that is triggered when a change is applied to an issue.
     * The object that is returned by this method is normally exported to the `rule` property, otherwise it is not
     * treated as a rule.
     *
     * @param ruleProperties A JSON object that defines the properties for the rule.
     * @returns The object representation of the rule.
     */
    onChange<T extends Requirements>(ruleProperties: RuleProperties<T>): unknown;
  }

  // tslint:disable-next-line:variable-name
  let Issue: IssueConstructor;

  interface Project {
    /**
     * Gets the number of minutes that occurred during working hours in a specified interval.
     * For example, if the interval is two days and the number of working hours in a day is set to 8, the result is
     * 2 * 8 * 60 = 960
     *
     * @param start Start of the interval.
     * @param end End of the interval.
     * @returns The number of minutes that occurred during working hours in the specified interval.
     */
    intervalToWorkingMinutes(start: number, end: number): number;
  }

  /**
   * A single element in a set of {@link Requirements}
   */
  interface Requirement {
    /**
     * The optional name of the field or entity. If not provided, the key (alias) for this requirement in the
     * {@link Requirements} object is used.
     */
    name?: string;

    /**
     * The data type of the entity. Can be one of the following custom field types: [...] {@link Field}.periodType
     */
    type: typeof Field.periodType;
  }

  /**
   * The `Requirements` object serves two purposes.
   * First, it functions as a safety net. It specifies the set of entities that must exist for a rule to work as
   * expected. Whenever one or more rule requirements are not met, corresponding errors are shown in the workflow
   * administration UI. The rule is not executed until all of the problems are fixed.
   *
   * Second, it functions as a reference.
   * Each entity in the requirements is plugged into the `context` object, so you can reference entities from inside
   * your context-dependent functions (like an `action` function).
   *
   * There are two types of requirements: project-wide and system-wide.
   * Project-wide requirements contain a list of custom fields that must be attached
   * to each project that uses the rule as well as the required values from the sets of values for each custom field.
   * System-wide requirements contain a list of other entities that must be available in YouTrack.
   * This includes users, groups, projects, issues, tags, saved searches, and issue link types.
   */
  type Requirements = Record<string, Requirement>;

  /**
   * A JSON object that defines the properties for the rule.
   */
  interface RuleProperties<T extends Requirements> {
    /**
     * The human-readable name of the rule. Displayed in the administrative UI in YouTrack.
     */
    title: string;

    /**
     * A function that is invoked to determine whether the action is applicable to an issue.
     */
    guard: GuardFunction<T>;

    /**
     * The function that is invoked on issue change.
     */
    action: ActionFunction<T>;

    /**
     * The set of entities that must be present for the script to work as expected.
     */
    requirements: T;
  }

  /**
   * The `Set` object stores unique values of any type, whether primitive values or
   * object references. The Set is used as storage for all multi-value objects in
   * this API: custom fields that store multiple values, issue links, issues in a project, and so on.
   * You can access single values in the collection directly (see first(), last(), get(index)),
   * use an iterator (see entries(), values()), or traverse with forEach(visitor)
   * and find(predicate) methods.
   *
   * The workflow API is based on ECMAScript 5.1.
   * This Set implementation mimics the functionality supported by the
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set|ES 6 Set interface}.
   */
  interface Set<T> {
    /**
     * The elements that are added to a field that stores multiple values in the current transaction.
     * Only relevant when the Set represents a multi-valued property (field) of a persistent entity.
     */
    added: Set<T>;

    /**
     * Apply a visitor function to each member of a collection.
     *
     * @example
     * issue.links['parent for'].forEach(function(child) {
     *   child.fields.Priority = issue.fields.Priority;
     * });
     *
     * @param visitor The function to be applied to each member of the collection.
     */
    forEach(visitor: (element: T) => void): void;

    /**
     * When the Set represents a multi-valued property (field) of a persistent entity and the field is changed in the
     * current transaction, this property is `true`.
     */
    isChanged: boolean;

    /**
     * The elements that are removed from a field that stores multiple values in the current transaction.
     * Only relevant when the Set represents a multi-valued property (field) of a persistent entity.
     */
    removed: Set<T>;
  }
}
