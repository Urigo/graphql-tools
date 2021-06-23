import { ExecutionResult, GraphQLSchema } from 'graphql';

export type IMockFn = () => unknown;
export type IScalarMock = unknown | IMockFn;
export type ITypeMock = () => { [fieldName: string]: unknown | IMockFn } | { [fieldName: string]: IMockFn };

export type IMocks = {
  [typeOrScalarName: string]: IScalarMock | ITypeMock;
};

export type KeyTypeConstraints = string | number;

export type TypePolicy = {
  /**
   * The name of the field that should be used as store `key`.
   *
   * If `false`, no field will be used and we'll generate a random string
   * as key.
   */
  keyFieldName?: string | false;
};

export type GetArgs<KeyT extends KeyTypeConstraints = string> = {
  typeName: string;
  key?: KeyT;
  fieldName?: string;
  /**
   * Optional arguments when querying the field.
   *
   * Querying the field with the same arguments will return
   * the same value. Deep equality is checked.
   *
   * ```ts
   * store.get('User', 1, 'friend', { id: 2 }) === store.get('User', 1, 'friend', { id: 2 })
   * store.get('User', 1, 'friend', { id: 2 }) !== store.get('User', 1, 'friend')
   * ```
   *
   * Args can be a record, just like `args` argument of field resolver or an
   * arbitrary string.
   */
  fieldArgs?: string | { [argName: string]: any };
  /**
   * If no value found, insert the `defaultValue`.
   */
  defaultValue?: unknown | { [fieldName: string]: any };
};

export type SetArgs<KeyT extends KeyTypeConstraints = string> = {
  typeName: string;
  key: KeyT;
  fieldName?: string;
  /**
   * Optional arguments when querying the field.
   *
   * @see GetArgs#fieldArgs
   */
  fieldArgs?: string | { [argName: string]: any };
  value?: unknown | { [fieldName: string]: any };
  /**
   * If the value for this field is already set, it won't
   * be overridden.
   *
   * Propagates down do nested `set`.
   */
  noOverride?: boolean;
};

export interface IMockStore {
  schema: GraphQLSchema;
  /**
   * Get a field value from the store for the given type, key and field
   * name — and optionally field arguments. If the field name is not given,
   * a reference to the type will be returned.
   *
   * If the the value for this field is not set, a value will be
   * generated according to field return type and mock functions.
   *
   * If the field's output type is a `ObjectType` (or list of `ObjectType`),
   * it will return a `Ref` (or array of `Ref`), ie a reference to an entity
   * in the store.
   *
   * Example:
   * ```ts
   * store.get('Query', 'ROOT', 'viewer');
   * > { $ref: { key: 'abc-737dh-djdjd', typeName: 'User' } }
   * store.get('User', 'abc-737dh-djdjd', 'name')
   * > "Hello World"
   * ```
   */
  get<KeyT extends KeyTypeConstraints = string, ReturnKeyT extends KeyTypeConstraints = string>(
    args: GetArgs<KeyT>
  ): unknown | Ref<ReturnKeyT>;
  /**
   * Shorthand for `get({typeName, key, fieldName, fieldArgs})`.
   */
  get<KeyT extends KeyTypeConstraints = string, ReturnKeyT extends KeyTypeConstraints = string>(
    typeName: string,
    key: KeyT,
    fieldNameOrFieldNames: string | string[],
    fieldArgs?: string | { [argName: string]: any }
  ): unknown | Ref<ReturnKeyT>;
  /**
   * Get a reference to the type.
   */
  get<KeyT extends KeyTypeConstraints = string>(
    typeName: string,
    keyOrDefaultValue?: KeyT | { [fieldName: string]: any },
    defaultValue?: { [fieldName: string]: any }
  ): unknown | Ref<KeyT>;

  /**
   * Shorthand for `get({typeName: ref.$ref.typeName, key: ref.$ref.key, fieldName, fieldArgs})`
   * @param ref
   * @param fieldNameOrFieldNames
   * @param fieldArgs
   */
  get<KeyT extends KeyTypeConstraints = string, ReturnKeyT extends KeyTypeConstraints = string>(
    ref: Ref<KeyT>,
    fieldNameOrFieldNames: string | string[],
    fieldArgs?: string | { [argName: string]: any }
  ): unknown | Ref<ReturnKeyT>;

  /**
   * Set a field value in the store for the given type, key and field
   * name — and optionally field arguments.
   *
   * If the the field return type is an `ObjectType` or a list of
   * `ObjectType`, you can set references to other entity as value:
   *
   * ```ts
   * // set the viewer name
   * store.set('User', 1, 'name', 'Alexandre);
   * store.set('Query', 'ROOT', 'viewer', store.get('User', 1));
   *
   * // set the friends of viewer
   * store.set('User', 2, 'name', 'Emily');
   * store.set('User', 3, 'name', 'Caroline');
   * store.set('User', 1, 'friends', [store.get('User', 2), store.get('User', 3)]);
   * ```
   *
   * But it also supports nested set:
   *
   * ```ts
   * store.set('Query', 'ROOT', 'viewer', {
   *  name: 'Alexandre',
   *  friends: [
   *    { name: 'Emily' }
   *    { name: 'Caroline }
   *  ]
   * });
   * ```
   */
  set<KeyT extends KeyTypeConstraints = string>(args: SetArgs<KeyT>): void;

  /**
   * Shorthand for `set({typeName, key, fieldName, value})`.
   */
  set<KeyT extends KeyTypeConstraints = string>(typeName: string, key: KeyT, fieldName: string, value?: unknown): void;

  /**
   * Set the given field values to the type with key.
   */
  set<KeyT extends KeyTypeConstraints = string>(
    typeName: string,
    key: KeyT,
    values: { [fieldName: string]: any }
  ): void;

  /**
   * Shorthand for `set({ref.$ref.typeName, ref.$ref.key, fieldName, value})`.
   */
  set<KeyT extends KeyTypeConstraints = string>(ref: Ref<KeyT>, fieldName: string, value?: unknown): void;

  /**
   * Set the given field values to the type with ref.
   */
  set<KeyT extends KeyTypeConstraints = string>(ref: Ref<KeyT>, values: { [fieldName: string]: any }): void;

  /**
   * Resets the mock store
   */
  reset(): void;
}

export type Ref<KeyT extends KeyTypeConstraints = string> = {
  $ref: {
    key: KeyT;
    typeName: string;
  };
};

export function isRef<KeyT extends KeyTypeConstraints = string>(maybeRef: unknown): maybeRef is Ref<KeyT> {
  return !!(maybeRef && typeof maybeRef === 'object' && '$ref' in maybeRef);
}

export function assertIsRef<KeyT extends KeyTypeConstraints = string>(
  maybeRef: unknown,
  message?: string
): asserts maybeRef is Ref<KeyT> {
  if (!isRef(maybeRef)) {
    throw new Error(message || `Expected ${maybeRef} to be a valid Ref.`);
  }
}

export function isRecord(obj: unknown): obj is { [key: string]: unknown } {
  return typeof obj === 'object' && obj !== null;
}

export interface IMockServer {
  /**
   * Executes the provided query against the mocked schema.
   * @param query GraphQL query to execute
   * @param vars Variables
   */
  query: (query: string, vars?: Record<string, any>) => Promise<ExecutionResult>;
}
