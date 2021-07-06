import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, buildSchema, GraphQLScalarType, Kind, GraphQLSchema, print } from 'graphql';
import { mergeSchemas, mergeSchemasAsync } from '../src/merge-schemas';
import { assertSome, printSchemaWithDirectives } from '@graphql-tools/utils';
import { assertListValueNode } from '../../testing/assertion';

describe('Merge Schemas', () => {
    it('Should include extensions in merged schemas', () => {
      const fooSchema = makeExecutableSchema({
        typeDefs: /* GraphQL */`
            type Query {
                foo: String
            }
        `,
        resolvers: {
            Query: {
                foo: () => 'FOO'
            }
        }
      });
      fooSchema.extensions = { schemaA: true };
      const barSchema = makeExecutableSchema({
          typeDefs: /* GraphQL */`
              type Query {
                  bar: String
              }
          `,
          resolvers: {
              Query: {
                  bar: () => 'BAR'
              }
          }
      });
      barSchema.extensions = { schemaB: true };

      const mergedSchema = mergeSchemas({
        schemas: [fooSchema, barSchema]
      });

      expect(mergedSchema.extensions).toEqual({ schemaA: true, schemaB: true  })
    });

    it('should merge two valid executable schemas', async () => {
        const fooSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    foo: String
                }
            `,
            resolvers: {
                Query: {
                    foo: () => 'FOO'
                }
            }
        });
        const barSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    bar: String
                }
            `,
            resolvers: {
                Query: {
                    bar: () => 'BAR'
                }
            }
        });
        const { errors, data } = await graphql({
            schema: mergeSchemas({
                schemas: [fooSchema, barSchema]
            }),
            source: `
                {
                    foo
                    bar
                }
            `
        });
        expect(errors).toBeFalsy();
        assertSome(data)
        expect(data['foo']).toBe('FOO');
        expect(data['bar']).toBe('BAR');
    });
    it('should merge two valid executable schemas async', async () => {
        const fooSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    foo: String
                }
            `,
            resolvers: {
                Query: {
                    foo: () => 'FOO'
                }
            }
        });
        const barSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    bar: String
                }
            `,
            resolvers: {
                Query: {
                    bar: () => 'BAR'
                }
            }
        });
        const { errors, data } = await graphql({
            schema: await mergeSchemasAsync({
                schemas: [fooSchema, barSchema]
            }),
            source: `
                {
                    foo
                    bar
                }
            `
        });
        expect(errors).toBeFalsy();
        assertSome(data)
        expect(data['foo']).toBe('FOO');
        expect(data['bar']).toBe('BAR');
    });
    it('should merge two valid executable schemas with extra resolvers', async () => {
        const fooSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    foo: String
                }
            `,
            resolvers: {
                Query: {
                    foo: () => 'FOO'
                }
            }
        });
        const barSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    bar: String
                    qux: String
                }
            `,
            resolvers: {
                Query: {
                    bar: () => 'BAR'
                }
            }
        });
        const { errors, data } = await graphql({
            schema: mergeSchemas({
                schemas: [fooSchema, barSchema],
                resolvers: {
                    Query: {
                        qux: () => 'QUX'
                    }
                }
            }),
            source: `
                {
                    foo
                    bar
                    qux
                }
            `
        });
        expect(errors).toBeFalsy();
        assertSome(data)
        expect(data['foo']).toBe('FOO');
        expect(data['bar']).toBe('BAR');
        expect(data['qux']).toBe('QUX');
    });
    it('should merge two valid executable schemas with extra typeDefs and resolvers', async () => {
        const fooSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    foo: String
                }
            `,
            resolvers: {
                Query: {
                    foo: () => 'FOO'
                }
            }
        });
        const barSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    bar: String
                }
            `,
            resolvers: {
                Query: {
                    bar: () => 'BAR'
                }
            }
        });
        const { errors, data } = await graphql({
            schema: mergeSchemas({
                schemas: [fooSchema, barSchema],
                typeDefs: /* GraphQL */`
                    type Query {
                        qux: String
                    }
                `,
                resolvers: {
                    Query: {
                        qux: () => 'QUX'
                    }
                }
            }),
            source: `
                {
                    foo
                    bar
                    qux
                }
            `
        });
        expect(errors).toBeFalsy();
        assertSome(data)
        expect(data['foo']).toBe('FOO');
        expect(data['bar']).toBe('BAR');
        expect(data['qux']).toBe('QUX');
    });
    it('should merge two valid schemas by keeping their directives to be used in extra typeDefs', async () => {
        const fooSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                directive @fooDirective on FIELD_DEFINITION
                type Query {
                    foo: String
                }
            `,
            resolvers: {
                Query: {
                    foo: () => 'FOO'
                }
            }
        });
        const barSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                type Query {
                    bar: String
                }
            `,
            resolvers: {
                Query: {
                    bar: () => 'BAR'
                }
            }
        });
        const { errors, data } = await graphql({
            schema: mergeSchemas({
                schemas: [fooSchema, barSchema],
                typeDefs: /* GraphQL */`
                    type Query {
                        qux: String @fooDirective
                    }
                `,
                resolvers: {
                    Query: {
                        qux: () => 'QUX'
                    }
                }
            }),
            source: `
                {
                    foo
                    bar
                    qux
                }
            `
        });
        expect(errors).toBeFalsy();
        assertSome(data)
        expect(data['foo']).toBe('FOO');
        expect(data['bar']).toBe('BAR');
        expect(data['qux']).toBe('QUX');
    });
    it('should merge valid schemas with interfaces correctly', async () => {
        const fooSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                interface Foo {
                    foo: String
                }
                type Bar implements Foo {
                    foo: String
                    bar: String
                }
                type Qux implements Foo {
                    foo: String
                    qux: String
                }
            `
        });
        const barSchema = makeExecutableSchema({
            typeDefs: /* GraphQL */`
                interface Foo {
                    foo: String
                }
                type Query {
                    bar: Foo
                    qux: Foo
                }
            `,
            resolvers: {
                Foo: {
                    __resolveType: (root: any) => {
                        if ('bar' in root) {
                            return 'Bar';
                        }
                        if ('qux' in root) {
                            return 'Qux';
                        }
                        return null;
                    }
                },
                Query: {
                    bar: () => ({ foo: 'foo', bar: 'bar' }),
                    qux: () => ({ foo: 'foo', qux: 'qux'})
                }
            }
        });
        const { errors, data } = await graphql({
            schema: mergeSchemas({
                schemas: [fooSchema, barSchema]
            }),
            source: `
                {
                    bar {
                        foo
                        ... on Bar {
                            bar
                        }
                    }
                    qux {
                        foo
                        ... on Qux {
                            qux
                        }
                    }
                }
            `
        });
        expect(errors).toBeFalsy();
        assertSome(data)
        expect(data['bar'].foo).toBe('foo');
        expect(data['bar'].bar).toBe('bar');
        expect(data['qux'].foo).toBe('foo');
        expect(data['qux'].qux).toBe('qux');
    });

    it('should merge scalars (part of resolvers)', async () => {
        const now = new Date();
        const schemaA = makeExecutableSchema({
            typeDefs: [`scalar Date`, `type Query { a: Date }`],
            resolvers: {
                Query: {
                    a: () => now,
                },
                Date: new GraphQLScalarType({
                    name: 'Date',
                    serialize(value) {
                        return new Date(value).toISOString();
                    },
                    parseValue(value) {
                        return new Date(value);
                    },
                    parseLiteral(ast) {
                        if (ast.kind !== Kind.STRING) {
                            throw new TypeError(`Date cannot represent non string type`);
                        }
                        return new Date(ast.value);
                    }
                })
            }
        });
        const schemaB = makeExecutableSchema({
            typeDefs: [`type Query { b: String }`],
        });

        const schema = mergeSchemas({ schemas: [schemaA, schemaB] });

        // original schema A
        const { data: dataA } = await graphql({
            schema: schemaA,
            source: /* GraphQL */` { a } `
        });

        assertSome(dataA)
        expect(dataA['a']).toEqual(now.toISOString());

        // merged schema
        const { data } = await graphql({
            schema,
            source: /* GraphQL */` { a } `
        });
        assertSome(data)
        expect(data['a']).toEqual(now.toISOString());
    });

    it.only('should not duplicate directives of scalars', () => {
        const schema = buildSchema(`
            directive @sqlType(type: String!) on SCALAR
            scalar JSON @sqlType(type: "json")
        `);
        const merged = mergeSchemas({ schemas: [schema] });
        expect(print(merged.getType('JSON')!.astNode!)).toEqual('scalar JSON @sqlType(type: "json")');
    });

    it('should merge when directive uses enum', () => {
        const merged = mergeSchemas({
            schemas: [buildSchema(/* GraphQL */`
                directive @date(format: DateFormat) on FIELD_DEFINITION

                enum DateFormat {
                    LOCAL
                    ISO
                }
            `)],
            typeDefs: /* GraphQL */`
                scalar Date
                type Query {
                    today: Date @date
                }
            `
        });

        expect(merged.getDirective('date')).toBeDefined();
      });
      it('should merge a lot of directives but without high memory usage', () => {
          let num = 100;
          const base = buildSchema(/* GraphQL */`
              directive @access(roles: [String]) on FIELD_DEFINITION

              type Query {
                test: Boolean @access(roles: ["Admin"])
              }
          `);

          let prev: GraphQLSchema = base;

          while (num--) {
              prev = mergeSchemas({schemas: [prev, base]});
          }
        const QueryType = prev.getQueryType()
        assertSome(QueryType)
        const fields = QueryType.getFields()
        assertSome(fields['test'].astNode)
        assertSome(fields['test'].astNode.directives)
        assertSome(fields['test'].astNode.directives[0])
        assertSome(fields['test'].astNode.directives[0].arguments)
        assertListValueNode(fields['test'].astNode.directives[0].arguments[0].value)

        expect(fields['test'].astNode.directives[0].arguments[0].value.values).toHaveLength(1);
      });
      it('should merge schemas with custom scalars', () => {
        const GraphQLUUID = new GraphQLScalarType({
            name: 'UUID',
            serialize: val => val,
            parseValue: val => val,
            parseLiteral: valueNode => {
                if (valueNode.kind === 'StringValue') {
                    return valueNode.value;
                }
                return null;
            }
        })
        const countrySchema = makeExecutableSchema({
          typeDefs: /* GraphQL */`
            scalar UUID
            type Country {
              id: UUID!
              name: String
            }
            type Query {
              country: Country
            }
          `,
          resolvers: {
            UUID: GraphQLUUID,
          }
        })


        const citySchema = makeExecutableSchema({
          typeDefs: /* GraphQL */`
            scalar UUID
            type City {
              id: ID!
              name: String
            }
            type Query {
              city: City
            }
          `,
        })

        const mergedSchema = mergeSchemas({
            schemas: [
                countrySchema,
                citySchema,
            ]
        });
        const printedSchema = printSchemaWithDirectives(mergedSchema);

        expect(printedSchema).toContain(/* GraphQL */`
type Query {
  country: Country
  city: City
}`.trim());
expect(printedSchema).toContain(/* GraphQL */`
scalar UUID
`.trim());
expect(printedSchema).toContain(/* GraphQL */`
type Country {
  id: UUID!
  name: String
}`.trim());
expect(printedSchema).toContain(/* GraphQL */`
type City {
  id: ID!
  name: String
}`.trim());
      })
});
