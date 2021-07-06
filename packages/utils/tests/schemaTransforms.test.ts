import { createHash } from 'crypto';

import {
  GraphQLObjectType,
  GraphQLSchema,
  printSchema,
  defaultFieldResolver,
  graphql,
  GraphQLString,
  GraphQLScalarType,
  GraphQLInputFieldConfig,
  GraphQLFieldConfig,
  isNonNullType,
  isScalarType,
  GraphQLID,
  isListType,
  GraphQLOutputType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLList,
  getNamedType,
  GraphQLNonNull,
} from 'graphql';

import formatDate from 'dateformat';

import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  mapSchema,
  MapperKind,
  getDirectives,
  ExecutionResult,
} from '@graphql-tools/utils';

import { addMocksToSchema } from '@graphql-tools/mock';

const typeDefs = `
  directive @schemaDirective(role: String) on SCHEMA
  directive @schemaExtensionDirective(role: String) on SCHEMA
  directive @queryTypeDirective on OBJECT
  directive @queryTypeExtensionDirective on OBJECT
  directive @queryFieldDirective on FIELD_DEFINITION
  directive @enumTypeDirective on ENUM
  directive @enumTypeExtensionDirective on ENUM
  directive @enumValueDirective on ENUM_VALUE
  directive @dateDirective(tz: String) on SCALAR
  directive @dateExtensionDirective(tz: String) on SCALAR
  directive @interfaceDirective on INTERFACE
  directive @interfaceExtensionDirective on INTERFACE
  directive @interfaceFieldDirective on FIELD_DEFINITION
  directive @inputTypeDirective on INPUT_OBJECT
  directive @inputTypeExtensionDirective on INPUT_OBJECT
  directive @inputFieldDirective on INPUT_FIELD_DEFINITION
  directive @mutationTypeDirective on OBJECT
  directive @mutationTypeExtensionDirective on OBJECT
  directive @mutationArgumentDirective on ARGUMENT_DEFINITION
  directive @mutationMethodDirective on FIELD_DEFINITION
  directive @objectTypeDirective on OBJECT
  directive @objectTypeExtensionDirective on OBJECT
  directive @objectFieldDirective on FIELD_DEFINITION
  directive @unionDirective on UNION
  directive @unionExtensionDirective on UNION

  schema @schemaDirective(role: "admin") {
    query: Query
    mutation: Mutation
  }

  extend schema @schemaExtensionDirective(role: "admin")

  type Query @queryTypeDirective {
    people: [Person] @queryFieldDirective
  }

  extend type Query @queryTypeExtensionDirective

  enum Gender @enumTypeDirective {
    NONBINARY @enumValueDirective
    FEMALE
    MALE
  }

  extend enum Gender @enumTypeExtensionDirective
  scalar Date @dateDirective(tz: "utc")

  extend scalar Date @dateExtensionDirective(tz: "utc")
  interface Named @interfaceDirective {
    name: String! @interfaceFieldDirective
  }

  extend interface Named @interfaceExtensionDirective
  input PersonInput @inputTypeDirective {
    name: String! @inputFieldDirective
    gender: Gender
  }

  extend input PersonInput @inputTypeExtensionDirective
  type Mutation @mutationTypeDirective {
    addPerson(
      input: PersonInput @mutationArgumentDirective
    ): Person @mutationMethodDirective
  }

  extend type Mutation @mutationTypeExtensionDirective
  type Person implements Named @objectTypeDirective {
    id: ID! @objectFieldDirective
    name: String!
  }

  extend type Person @objectTypeExtensionDirective
  union WhateverUnion @unionDirective = Person | Query | Mutation

  extend union WhateverUnion @unionExtensionDirective
`;

describe('@directives', () => {
  test('can be iterated with mapSchema', () => {
    const visited: Set<GraphQLObjectType> = new Set();

    function addObjectTypeToSetDirective(directiveNames: Array<string>): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
          const directives = getDirectives(schema, type);
          for (const directiveName in directives) {
            if (directiveNames.includes(directiveName)) {
              expect(type.name).toBe(schema.getQueryType()?.name);
              visited.add(type);
            }
          }
          return undefined;
        }
      })
    }

    makeExecutableSchema({
      typeDefs,
      schemaTransforms: [
        addObjectTypeToSetDirective(['queryTypeDirective', 'queryTypeExtensionDirective'])
      ]
    });

    expect(visited.size).toBe(1);
  });

  test('can visit the schema directly', () => {
    const visited: Array<GraphQLSchema> = [];

    function recordSchemaDirectiveUses(directiveNames: Array<string>): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => {
        const directives = getDirectives(schema, schema);
          for (const directiveName in directives) {
          if (directiveNames.includes(directiveName)) {
            visited.push(schema);
          }
        }
        return schema;
      }
    }

    const schema = makeExecutableSchema({
      typeDefs,
      schemaTransforms: [
        recordSchemaDirectiveUses(['schemaDirective', 'schemaExtensionDirective'])
      ]
    });

    const printedSchema = printSchema(makeExecutableSchema({ typeDefs }));
    expect(printSchema(schema)).toEqual(printedSchema);

    expect(visited.length).toBe(2);
    expect(printSchema(visited[0])).toEqual(printedSchema);
    expect(printSchema(visited[1])).toEqual(printedSchema);
  });

  test('can be used to implement the @upper example', () => {
    function upperDirective(directiveName: string) {
      return {
        upperDirectiveTypeDefs: `directive @${directiveName} on FIELD_DEFINITION`,
        upperDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const directives = getDirectives(schema, fieldConfig);
            if (directives[directiveName]) {
              const { resolve = defaultFieldResolver } = fieldConfig;
              fieldConfig.resolve = async function (source, args, context, info) {
                const result = await resolve(source, args, context, info);
                if (typeof result === 'string') {
                  return result.toUpperCase();
                }
                return result;
              }
              return fieldConfig;
            }
          }
        })
      };
    }

    const { upperDirectiveTypeDefs, upperDirectiveTransformer } = upperDirective('upper');

    const schema = makeExecutableSchema({
      typeDefs: [upperDirectiveTypeDefs, `
        type Query {
          hello: String @upper
        }
      `],
      resolvers: {
        Query: {
          hello() {
            return 'hello world';
          },
        },
      },
      schemaTransforms: [upperDirectiveTransformer],
    });

    return graphql(
      schema,
      `
        query {
          hello
        }
      `,
    ).then(({ data }) => {
      expect(data).toEqual({
        hello: 'HELLO WORLD',
      });
    });
  });

  test('can be used to implement the @deprecated example', () => {
    function deprecatedDirective(directiveName: string) {
      return {
        deprecatedDirectiveTypeDefs: `directive @${directiveName}(reason: String) on FIELD_DEFINITION | ENUM_VALUE`,
        deprecatedDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const directives = getDirectives(schema, fieldConfig);
            const directiveArgumentMap = directives[directiveName];
            if (directiveArgumentMap) {
              fieldConfig.deprecationReason = directiveArgumentMap.reason;
              return fieldConfig;
            }
          },
          [MapperKind.ENUM_VALUE]: (enumValueConfig) => {
            const directives = getDirectives(schema, enumValueConfig);
            const directiveArgumentMap = directives[directiveName];
            if (directiveArgumentMap) {
              enumValueConfig.deprecationReason = directiveArgumentMap.reason;
              return enumValueConfig;
            }
          }
        }),
      };
    }

    const { deprecatedDirectiveTypeDefs, deprecatedDirectiveTransformer } = deprecatedDirective('deprecated');

    const schema = makeExecutableSchema({
      typeDefs: [deprecatedDirectiveTypeDefs, `
        type ExampleType {
          newField: String
          oldField: String @deprecated(reason: "Use \`newField\`.")
        }

        type Query {
          rootField: ExampleType
        }
      `],
      schemaTransforms: [deprecatedDirectiveTransformer],
    });

    expect((schema.getType('ExampleType') as GraphQLObjectType).getFields()['oldField'].deprecationReason).toBe('Use \`newField\`.')
  });

  test('can be used to implement the @date example', () => {
    function dateDirective(directiveName: string) {
      return {
        dateDirectiveTypeDefs: `directive @${directiveName}(format: String) on FIELD_DEFINITION`,
        dateDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const directives = getDirectives(schema, fieldConfig);
            const directiveArgumentMap = directives[directiveName];
            if (directiveArgumentMap) {
              const { resolve = defaultFieldResolver } = fieldConfig;
              const { format } = directiveArgumentMap;
              fieldConfig.resolve = async function (source, args, context, info) {
                const date = await resolve(source, args, context, info);
                return formatDate(date, format, true);

              }
              return fieldConfig;
            }
          }
        }),
      };
    }

    const { dateDirectiveTypeDefs, dateDirectiveTransformer } = dateDirective('date');

    const schema = makeExecutableSchema({
      typeDefs: [dateDirectiveTypeDefs, `
        scalar Date

        type Query {
          today: Date @date(format: "mmmm d, yyyy")
        }
      `],
      resolvers: {
        Query: {
          today() {
            return new Date(1519688273858).toUTCString();
          },
        },
      },
      schemaTransforms: [dateDirectiveTransformer],
    });

    return graphql(
      schema,
      `
        query {
          today
        }
      `,
    ).then(({ data }) => {
      expect(data).toEqual({
        today: 'February 26, 2018',
      });
    });
  });

  test('can be used to implement the @date by adding an argument', async () => {
    function formattableDateDirective(directiveName: string) {
      return {
        formattableDateDirectiveTypeDefs: `directive @${directiveName}(
            defaultFormat: String = "mmmm d, yyyy"
          ) on FIELD_DEFINITION
        `,
        formattableDateDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const directives = getDirectives(schema, fieldConfig);
            const directiveArgumentMap = directives[directiveName];
            if (directiveArgumentMap) {
              const { resolve = defaultFieldResolver } = fieldConfig;
              const { defaultFormat } = directiveArgumentMap;

              if (!fieldConfig.args) {
                throw new Error("Unexpected Error. args should be defined.")
              }

              fieldConfig.args['format'] = {
                type: GraphQLString,
              };

              fieldConfig.type = GraphQLString;
              fieldConfig.resolve = async function (
                source,
                { format, ...args },
                context,
                info,
              ) {
                const newFormat = format || defaultFormat;
                const date = await resolve(source, args, context, info);
                return formatDate(date, newFormat, true);
              };
              return fieldConfig;
            }
          }
        }),
      };
    }

    const { formattableDateDirectiveTypeDefs, formattableDateDirectiveTransformer } = formattableDateDirective('date');

    const schema = makeExecutableSchema({
      typeDefs: [formattableDateDirectiveTypeDefs, `
        scalar Date

        type Query {
          today: Date @date
        }
      `],
      resolvers: {
        Query: {
          today() {
            return new Date(1521131357195);
          },
        },
      },
      schemaTransforms: [formattableDateDirectiveTransformer],
    });

    const resultNoArg = await graphql(schema, 'query { today }');

    if (resultNoArg.errors != null) {
      expect(resultNoArg.errors).toEqual([]);
    }

    expect(resultNoArg.data).toEqual({ today: 'March 15, 2018' });

    const resultWithArg = await graphql(
      schema,
      `
        query {
          today(format: "dd mmm yyyy")
        }
      `,
    );

    if (resultWithArg.errors != null) {
      expect(resultWithArg.errors).toEqual([]);
    }

    expect(resultWithArg.data).toEqual({ today: '15 Mar 2018' });
  });

  test('can be used to implement the @auth example', async () => {
    function authDirective(directiveName: string, getUserFn: (token: string) => { hasRole: (role: string) => boolean} ) {
      const typeDirectiveArgumentMaps: Record<string, any> = {};
      return {
        authDirectiveTypeDefs: `directive @${directiveName}(
          requires: Role = ADMIN,
        ) on OBJECT | FIELD_DEFINITION

        enum Role {
          ADMIN
          REVIEWER
          USER
          UNKNOWN
        }`,
        authDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.TYPE]: (type) => {
            const typeDirectives = getDirectives(schema, type);
            typeDirectiveArgumentMaps[type.name] = typeDirectives[directiveName];
            return undefined;
          },
          [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
            const fieldDirectives = getDirectives(schema, fieldConfig);
            const directiveArgumentMap = fieldDirectives[directiveName] ?? typeDirectiveArgumentMaps[typeName];
            if (directiveArgumentMap) {
              const { requires } = directiveArgumentMap;
              if (requires) {
                const { resolve = defaultFieldResolver } = fieldConfig;
                fieldConfig.resolve = function (source, args, context, info) {
                  const user = getUserFn(context.headers.authToken);
                  if (!user.hasRole(requires)) {
                    throw new Error('not authorized');
                  }
                  return resolve(source, args, context, info);
                }
                return fieldConfig;
              }
            }
          }
        })
      };
    }

    function getUser(token: string) {
      const roles = ['UNKNOWN', 'USER', 'REVIEWER', 'ADMIN'];
      return {
        hasRole: (role: string) => {
          const tokenIndex = roles.indexOf(token);
          const roleIndex = roles.indexOf(role);
          return roleIndex >= 0 && tokenIndex >= roleIndex;
        },
      };
    }

    const { authDirectiveTypeDefs, authDirectiveTransformer } = authDirective('auth', getUser);

    const schema = makeExecutableSchema({
      typeDefs: [authDirectiveTypeDefs, `
        type User @auth(requires: USER) {
          name: String
          banned: Boolean @auth(requires: ADMIN)
          canPost: Boolean @auth(requires: REVIEWER)
        }

        type Query {
          users: [User]
        }
      `],
      resolvers: {
        Query: {
          users() {
            return [
              {
                banned: true,
                canPost: false,
                name: 'Ben',
              },
            ];
          },
        },
      },
      schemaTransforms: [authDirectiveTransformer],
    });

    function execWithRole(role: string): Promise<ExecutionResult> {
      return graphql(
        schema,
        `
          query {
            users {
              name
              banned
              canPost
            }
          }
        `,
        null,
        {
          headers: {
            authToken: role,
          },
        },
      );
    }

    function assertStringArray(input: Array<unknown>): asserts input is Array<string> {
      if (input.some(item => typeof item !== "string")) {
        throw new Error("All items in array should be strings.")
      }
    }

    function checkErrors(
      expectedCount: number,
      ...expectedNames: Array<string>
    ) {
      return function ({
        errors = [],
        data,
      }: ExecutionResult) {
        expect(errors.length).toBe(expectedCount);
        expect(
          errors.every((error) => error.message === 'not authorized'),
        ).toBeTruthy();
        const actualNames = errors.map((error) => error.path!.slice(-1)[0]);
        assertStringArray(actualNames)
        expect(expectedNames.sort((a, b) => a.localeCompare(b))).toEqual(
          actualNames.sort((a, b) => a.localeCompare(b)),
        );
        return data;
      };
    }

    return Promise.all([
      execWithRole('UNKNOWN').then(checkErrors(3, 'banned', 'canPost', 'name')),
      execWithRole('USER').then(checkErrors(2, 'banned', 'canPost')),
      execWithRole('REVIEWER').then(checkErrors(1, 'banned')),
      execWithRole('ADMIN')
        .then(checkErrors(0))
        .then((data) => {
          expect(data?.['users'].length).toBe(1);
          expect(data?.['users'][0].banned).toBe(true);
          expect(data?.['users'][0].canPost).toBe(false);
          expect(data?.['users'][0].name).toBe('Ben');
        }),
    ]);
  });

  test('can be used to implement the @length example', async () => {
    function lengthDirective(directiveName: string) {
      class LimitedLengthType extends GraphQLScalarType {
        constructor(type: GraphQLScalarType, maxLength: number) {
          super({
            name: `${type.name}WithLengthAtMost${maxLength.toString()}`,

            serialize(value: string) {
              const newValue: string = type.serialize(value);
              expect(typeof newValue.length).toBe('number');
              if (newValue.length > maxLength) {
                throw new Error(
                  `expected ${newValue.length.toString(
                    10,
                  )} to be at most ${maxLength.toString(10)}`,
                );
              }
              return newValue;
            },

            parseValue(value: string) {
              return type.parseValue(value);
            },

            parseLiteral(ast) {
              return type.parseLiteral(ast, {});
            },
          });
        }
      }

      const limitedLengthTypes: Record<string, Record<number, GraphQLScalarType>> = {};

      function getLimitedLengthType(type: GraphQLScalarType, maxLength: number): GraphQLScalarType {
        const limitedLengthTypesByTypeName = limitedLengthTypes[type.name]
        if (!limitedLengthTypesByTypeName) {
          const newType = new LimitedLengthType(type, maxLength);
          limitedLengthTypes[type.name] = {}
          limitedLengthTypes[type.name][maxLength] = newType;
          return newType;
        }

        const limitedLengthType = limitedLengthTypesByTypeName[maxLength];
        if (!limitedLengthType) {
          const newType = new LimitedLengthType(type, maxLength);
          limitedLengthTypesByTypeName[maxLength] = newType;
          return newType;
        }

        return limitedLengthType;
      }

      function wrapType<F extends GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig>(fieldConfig: F, directiveArgumentMap: Record<string, any>): void {
        if (isNonNullType(fieldConfig.type) && isScalarType(fieldConfig.type.ofType)) {
          fieldConfig.type = getLimitedLengthType(fieldConfig.type.ofType, directiveArgumentMap['max']);
        } else if (isScalarType(fieldConfig.type)) {
          fieldConfig.type = getLimitedLengthType(fieldConfig.type, directiveArgumentMap['max']);
        } else {
          throw new Error(`Not a scalar type: ${fieldConfig.type.toString()}`);
        }
      }

      return {
        lengthDirectiveTypeDefs: `directive @${directiveName}(max: Int) on FIELD_DEFINITION | INPUT_FIELD_DEFINITION`,
        lengthDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.FIELD]: (fieldConfig) => {
            const directives = getDirectives(schema, fieldConfig);
            const directiveArgumentMap = directives[directiveName];
            if (directiveArgumentMap) {
              wrapType(fieldConfig, directiveArgumentMap);
              return fieldConfig;
            }
          }
        }),
      };
    }

    const { lengthDirectiveTypeDefs, lengthDirectiveTransformer } = lengthDirective('length');

    const schema = makeExecutableSchema({
      typeDefs: [lengthDirectiveTypeDefs, `
        type Query {
          books: [Book]
        }

        type Book {
          title: String @length(max: 10)
        }

        type Mutation {
          createBook(book: BookInput): Book
        }

        input BookInput {
          title: String! @length(max: 10)
        }`]
      ,
      resolvers: {
        Query: {
          books() {
            return [
              {
                title: 'abcdefghijklmnopqrstuvwxyz',
              },
            ];
          },
        },
        Mutation: {
          createBook(_parent, args) {
            return args.book;
          },
        },
      },
      schemaTransforms: [lengthDirectiveTransformer],
    });

    const { errors } = await graphql(
      schema,
      `
        query {
          books {
            title
          }
        }
      `,
    );
    expect(errors?.length).toBe(1);
    expect(errors?.[0].message).toBe('expected 26 to be at most 10');

    const result = await graphql(
      schema,
      `
        mutation {
          createBook(book: { title: "safe title" }) {
            title
          }
        }
      `,
    );

    if (result.errors != null) {
      expect(result.errors).toEqual([]);
    }

    expect(result.data).toEqual({
      createBook: {
        title: 'safe title',
      },
    });
  });

  test('can be used to implement the @uniqueID example', () => {
    function uniqueIDDirective(directiveName: string) {
      return {
        uniqueIDDirectiveTypeDefs: `directive @${directiveName}(name: String, from: [String]) on OBJECT`,
        uniqueIDDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
          [MapperKind.OBJECT_TYPE]: (type) => {
            const directives = getDirectives(schema, type);
            const directiveArgumentMap = directives[directiveName];
            if (directiveArgumentMap) {
              const { name, from } = directiveArgumentMap;
              const config = type.toConfig();
              config.fields[name] = {
                type: GraphQLID,
                description: 'Unique ID',
                args: {},
                resolve(object: any) {
                  const hash = createHash('sha1');
                  hash.update(type.name);
                  for (const fieldName of from ){
                    hash.update(String(object[fieldName]));
                  }
                  return hash.digest('hex');
                },
              };
              return new GraphQLObjectType(config);
            }
          }
        }),
      };
    }

    const { uniqueIDDirectiveTypeDefs, uniqueIDDirectiveTransformer } = uniqueIDDirective('uniqueID');

    const schema = makeExecutableSchema({
      typeDefs: [uniqueIDDirectiveTypeDefs, `
        type Query {
          people: [Person]
          locations: [Location]
        }

        type Person @uniqueID(name: "uid", from: ["personID"]) {
          personID: Int
          name: String
        }

        type Location @uniqueID(name: "uid", from: ["locationID"]) {
          locationID: Int
          address: String
        }
      `],
      resolvers: {
        Query: {
          people() {
            return [
              {
                personID: 1,
                name: 'Ben',
              },
            ];
          },
          locations() {
            return [
              {
                locationID: 1,
                address: '140 10th St',
              },
            ];
          },
        },
      },
      schemaTransforms: [uniqueIDDirectiveTransformer],
    });

    return graphql(
      schema,
      `
        query {
          people {
            uid
            personID
            name
          }
          locations {
            uid
            locationID
            address
          }
        }
      `,
      null,
      {},
    ).then((result) => {
      const { data } = result;

      expect(data?.['people']).toEqual([
        {
          uid: '580a207c8e94f03b93a2b01217c3cc218490571a',
          personID: 1,
          name: 'Ben',
        },
      ]);

      expect(data?.['locations']).toEqual([
        {
          uid: 'c31b71e6e23a7ae527f94341da333590dd7cba96',
          locationID: 1,
          address: '140 10th St',
        },
      ]);
    });
  });

  test('automatically updates references to changed types', () => {
    function renameObjectTypeToHumanDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: (type) => {
          const directives = getDirectives(schema, type);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const config = type.toConfig();
            config.name = 'Human';
            return new GraphQLObjectType(config);
          }
        }
      });
    }

    const schema = makeExecutableSchema({
      typeDefs,
      schemaTransforms: [renameObjectTypeToHumanDirective('objectTypeDirective')]
    });

    const Query = schema.getType('Query') as GraphQLObjectType;
    const peopleType = Query.getFields()['people'].type;
    if (isListType(peopleType)) {
      expect(peopleType.ofType).toBe(schema.getType('Human'));
    } else {
      throw new Error('Query.people not a GraphQLList type');
    }

    const Mutation = schema.getType('Mutation') as GraphQLObjectType;
    const addPersonResultType = Mutation.getFields()['addPerson'].type;
    expect(addPersonResultType).toBe(
      schema.getType('Human') as GraphQLOutputType,
    );

    const WhateverUnion = schema.getType('WhateverUnion') as GraphQLUnionType;
    const found = WhateverUnion.getTypes().some((type) => {
      if (type.name === 'Human') {
        expect(type).toBe(schema.getType('Human'));
        return true;
      }
      return false;
    });
    expect(found).toBe(true);

    // Make sure that the Person type was actually removed.
    expect(typeof schema.getType('Person')).toBe('undefined');
  });

  test('can remove enum values', () => {
    function removeEnumValueDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.ENUM_VALUE]: (enumValueConfig) => {
          const directives = getDirectives(schema, enumValueConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap && directiveArgumentMap.if) {
            return null;
          }
        }
      });
    }

    const schema = makeExecutableSchema({
      typeDefs: `
      directive @remove(if: Boolean) on ENUM_VALUE

      type Query {
        age(unit: AgeUnit): Int
      }

      enum AgeUnit {
        DOG_YEARS
        TURTLE_YEARS @remove(if: true)
        PERSON_YEARS @remove(if: false)
      }`,

      schemaTransforms: [removeEnumValueDirective('remove')]
    });

    const AgeUnit = schema.getType('AgeUnit') as GraphQLEnumType;
    expect(AgeUnit.getValues().map((value) => value.name)).toEqual([
      'DOG_YEARS',
      'PERSON_YEARS',
    ]);
  });

  test("can modify enum value's external value", () => {
    function modifyExternalEnumValueDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.ENUM_VALUE]: (enumValueConfig) => {
          const directives = getDirectives(schema, enumValueConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            return [directiveArgumentMap.new, enumValueConfig];
          }
        }
      });
    }

    const schema = makeExecutableSchema({
      typeDefs: `
        directive @value(new: String!) on ENUM_VALUE

        type Query {
          device: Device
        }

        enum Device {
          PHONE
          TABLET
          LAPTOP @value(new: "COMPUTER")
        }
      `,
      schemaTransforms: [modifyExternalEnumValueDirective('value')]
    });

    const Device = schema.getType('Device') as GraphQLEnumType;
    expect(Device.getValues().map((value) => value.name)).toEqual([
      'PHONE',
      'TABLET',
      'COMPUTER',
    ]);
  });

  test("can modify enum value's internal value", () => {
    function modifyInternalEnumValueDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.ENUM_VALUE]: (enumValueConfig) => {
          const directives = getDirectives(schema, enumValueConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            enumValueConfig.value = directiveArgumentMap.new;
            return enumValueConfig;
          }
        }
      });
    }

    const schema = makeExecutableSchema({
      typeDefs: `
        directive @value(new: String!) on ENUM_VALUE

        type Query {
          device: Device
        }

        enum Device {
          PHONE
          TABLET
          LAPTOP @value(new: "COMPUTER")
        }
      `,
      schemaTransforms: [modifyInternalEnumValueDirective('value')]
    });

    const Device = schema.getType('Device') as GraphQLEnumType;
    expect(Device.getValues().map((value) => value.value)).toEqual([
      'PHONE',
      'TABLET',
      'COMPUTER',
    ]);
  });

  test('can swap names of GraphQLNamedType objects', () => {
    function renameObjectTypeDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: (type) => {
          const directives = getDirectives(schema, type);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const config = type.toConfig();
            config.name = directiveArgumentMap.to;
            return new GraphQLObjectType(config);
          }
        }
      });
    }

    const schema = makeExecutableSchema({
      typeDefs: `
        directive @rename(to: String) on OBJECT

        type Query {
          people: [Person]
        }

        type Person @rename(to: "Human") {
          heightInInches: Int
        }

        scalar Date

        type Human @rename(to: "Person") {
          born: Date
        }
      `,
      schemaTransforms: [renameObjectTypeDirective('rename')]
    });

    const Human = schema.getType('Human') as GraphQLObjectType;
    expect(Human.name).toBe('Human');
    expect(Human.getFields()['heightInInches'].type).toBe(GraphQLInt);

    const Person = schema.getType('Person') as GraphQLObjectType;
    expect(Person.name).toBe('Person');
    expect(Person.getFields()['born'].type).toBe(
      schema.getType('Date') as GraphQLScalarType,
    );

    const Query = schema.getType('Query') as GraphQLObjectType;
    const peopleType = Query.getFields()['people'].type as GraphQLList<
      GraphQLObjectType
    >;
    expect(peopleType.ofType).toBe(Human);
  });

  test('does not enforce query directive locations (issue #680)', () => {
    function addObjectTypeToSetDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
          const directives = getDirectives(schema, type);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            expect(type.name).toBe(schema.getQueryType()?.name);
            visited.add(type);
          }
          return undefined;
        }
      })
    }

    const visited = new Set<GraphQLObjectType>();
    makeExecutableSchema({
      typeDefs: `
        directive @hasScope(scope: [String]) on QUERY | FIELD | OBJECT

        type Query @hasScope {
          oyez: String
        }
      `,
      schemaTransforms: [addObjectTypeToSetDirective('hasScope')]
    });

    expect(visited.size).toBe(1);
  });

  test('allows multiple directives when first replaces type (issue #851)', () => {
    function upperDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directives = getDirectives(schema, fieldConfig);
          if (directives[directiveName]) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            fieldConfig.resolve = async function (source, args, context, info) {
              const result = await resolve(source, args, context, info);
              if (typeof result === 'string') {
                return result.toUpperCase();
              }
              return result;
            }
            return fieldConfig;
          }
        }
      });
    }

    function reverseDirective(directiveName: string): (schema: GraphQLSchema) => GraphQLSchema {
      return schema => mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directives = getDirectives(schema, fieldConfig);
          if (directives[directiveName]) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            fieldConfig.resolve = async function (source, args, context, info) {
              const result = await resolve(source, args, context, info);
              if (typeof result === 'string') {
                return result.split('').reverse().join('');
              }
              return result;
            }
            return fieldConfig;
          }
        }
      });
    }

    const schema = makeExecutableSchema({
      typeDefs: `
        directive @upper on FIELD_DEFINITION
        directive @reverse on FIELD_DEFINITION

        type Query {
          hello: String @upper @reverse
        }
      `,
      resolvers: {
        Query: {
          hello() {
            return 'hello world';
          },
        },
      },
      schemaTransforms: [upperDirective('upper'), reverseDirective('reverse')]
    });

    return graphql(
      schema,
      `
        query {
          hello
        }
      `,
    ).then(({ data }) => {
      expect(data).toEqual({
        hello: 'DLROW OLLEH',
      });
    });
  });

  test('allows creation of types that reference other types (issue #1877)', async () => {
    function listWrapperTransformer(schema: GraphQLSchema) {
      const listWrapperTypes = new Map();
      return mapSchema(schema, {
        [MapperKind.COMPOSITE_FIELD]: (fieldConfig, fieldName) => {
          const hasDirectiveAnnotation = !!getDirectives(schema, fieldConfig)['addListWrapper'];

          // Leave the field untouched if it does not have the directive annotation
          if (!hasDirectiveAnnotation) {
            return undefined;
          }

          const itemTypeInList = getNamedType(fieldConfig.type);
          const itemTypeNameInList = itemTypeInList.name;

          // 1. Creating the XListWrapper type and replace the type of the field with that
          if (!listWrapperTypes.has(itemTypeNameInList)) {
            listWrapperTypes.set(itemTypeNameInList, new GraphQLObjectType({
              name: `${itemTypeNameInList}ListWrapper`,
              fields: {
                // Adding `size` field
                size: {
                  type: new GraphQLNonNull(GraphQLInt),
                  description: 'The number of items in the `items` field',
                },
                // Creating a new List which contains the same type than the original List
                items: {
                  type: new GraphQLNonNull(new GraphQLList(itemTypeInList))
                }
              }
            }));
          }

          fieldConfig.type = listWrapperTypes.get(itemTypeNameInList);

          // 2. Replacing resolver to return `{ size, items }`
          const originalResolver = fieldConfig.resolve;

          fieldConfig.resolve = (parent, args, ctx, info) => {
            const value = originalResolver ? originalResolver(parent, args, ctx, info) : parent[fieldName];
            const items = value || [];

            return {
              size: items.length,
              items
            };
          };

          // 3. Returning the updated `fieldConfig`
          return fieldConfig;
        },
      });
    }

    let schema = makeExecutableSchema({
      typeDefs: `
        directive @addListWrapper on FIELD_DEFINITION

        type Query {
          me: Person
        }
        type Person {
          name: String!
          friends: [Person] @addListWrapper
        }
      `,
      schemaTransforms: [listWrapperTransformer]
    });

    schema = addMocksToSchema({ schema });

    const result = await graphql(
      schema,
      `
        query {
          me {
            friends {
              items {
                name
              }
            }
          }
        }
      `,
    );

    const expectedResult: any = {
      me: {
        friends: {
          items: [
            {
              name: 'Hello World',
            },
            {
              name: 'Hello World',
            },
          ]
        },
      }
    };

    expect(result.data).toEqual(expectedResult);
  });
});
