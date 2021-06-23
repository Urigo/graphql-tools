import { makeExecutableSchema } from '@graphql-tools/schema';
import { filterSchema } from '@graphql-tools/utils';
import { GraphQLObjectType, GraphQLInterfaceType, GraphQLInputObjectType } from 'graphql';

describe('filterSchema', () => {
  it('filters root fields', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          keep: String
          omit: String
        }
        type Mutation {
          keepThis(id: ID): String
          omitThis(id: ID): String
        }
      `
    });

    const filtered = filterSchema({
      schema,
      rootFieldFilter: (_opName, fieldName) => fieldName?.startsWith('keep') ?? false,
    });

    expect((filtered.getType('Query') as GraphQLObjectType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('Query') as GraphQLObjectType).getFields()['omit']).toBeUndefined();
    expect((filtered.getType('Mutation') as GraphQLObjectType).getFields()['keepThis']).toBeDefined();
    expect((filtered.getType('Mutation') as GraphQLObjectType).getFields()['omitThis']).toBeUndefined();
  });

  it('filters types', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Keep implements IKeep {
          field(input: KeepInput): String
        }
        interface IKeep {
          field(input: KeepInput): String
        }
        type Remove implements IRemove {
          field(input: RemoveInput): String
        }
        interface IRemove {
          field(input: RemoveInput): String
        }
        union KeepMany = Keep | Remove
        union RemoveMany = Keep | Remove
        input KeepInput {
          field: String
        }
        input RemoveInput {
          field: String
        }
        enum KeepValues {
          VALUE
        }
        enum RemoveValues {
          VALUE
        }
        scalar KeepScalar
        scalar RemoveScalar
      `
    });

    const filtered = filterSchema({
      schema,
      typeFilter: (typeName) => !/^I?Remove/.test(typeName)
    });

    expect(filtered.getType('Keep')).toBeDefined();
    expect(filtered.getType('IKeep')).toBeDefined();
    expect(filtered.getType('KeepMany')).toBeDefined();
    expect(filtered.getType('KeepInput')).toBeDefined();
    expect(filtered.getType('KeepValues')).toBeDefined();
    expect(filtered.getType('KeepScalar')).toBeDefined();

    expect(filtered.getType('Remove')).toBeUndefined();
    expect(filtered.getType('IRemove')).toBeUndefined();
    expect(filtered.getType('RemoveMany')).toBeUndefined();
    expect(filtered.getType('RemoveInput')).toBeUndefined();
    expect(filtered.getType('RemoveValues')).toBeUndefined();
    expect(filtered.getType('RemoveScalar')).toBeUndefined();
  });

  it('filters object fields', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Thing implements IThing {
          keep: String
          omit: String
        }
        interface IThing {
          control: String
        }
      `
    });

    const filtered = filterSchema({
      schema,
      objectFieldFilter: (_typeName, fieldName) => fieldName?.startsWith('keep') ?? false,
    });

    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['omit']).toBeUndefined();
    expect((filtered.getType('IThing') as GraphQLInterfaceType).getFields()['control']).toBeDefined();
  });

  it('filters interface fields', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        interface IThing {
          keep: String
          omit: String
        }
        type Thing implements IThing {
          control: String
        }
      `
    });

    const filtered = filterSchema({
      schema,
      interfaceFieldFilter: (_typeName, fieldName) => fieldName?.startsWith('keep') ?? false,
    });

    expect((filtered.getType('IThing') as GraphQLInterfaceType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('IThing') as GraphQLInterfaceType).getFields()['omit']).toBeUndefined();
    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['control']).toBeDefined();
  });

  it('filters input object fields', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        input ThingInput {
          keep: String
          omit: String
        }
        type Thing {
          control: String
        }
      `
    });

    const filtered = filterSchema({
      schema,
      inputObjectFieldFilter: (_typeName, fieldName) => fieldName?.startsWith('keep') ?? false,
    });

    expect((filtered.getType('ThingInput') as GraphQLInputObjectType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('ThingInput') as GraphQLInputObjectType).getFields()['omit']).toBeUndefined();
    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['control']).toBeDefined();
  });

  it('filters all field types', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Thing implements IThing {
          keep: String
          omit: String
        }
        interface IThing {
          keep: String
          omit: String
        }
        input ThingInput {
          keep: String
          omit: String
        }
      `
    });

    const filtered = filterSchema({
      schema,
      fieldFilter: (_typeName, fieldName) => fieldName?.startsWith('keep') ?? false,
    });

    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['omit']).toBeUndefined();
    expect((filtered.getType('IThing') as GraphQLInterfaceType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('IThing') as GraphQLInterfaceType).getFields()['omit']).toBeUndefined();
    expect((filtered.getType('ThingInput') as GraphQLInputObjectType).getFields()['keep']).toBeDefined();
    expect((filtered.getType('ThingInput') as GraphQLInputObjectType).getFields()['omit']).toBeUndefined();
  });

  it('filters all arguments', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          field(keep: String, omit: String): String
        }
        type Thing implements IThing {
          field(keep: String, omit: String): String
        }
        interface IThing {
          field(keep: String, omit: String): String
        }
      `
    });

    const filtered = filterSchema({
      schema,
      argumentFilter: (_typeName, _fieldName, argName) => argName?.startsWith('keep') ?? false,
    });

    expect((filtered.getType('Query') as GraphQLObjectType).getFields()['field'].args.map(arg => arg.name)).toEqual(['keep']);
    expect((filtered.getType('Thing') as GraphQLObjectType).getFields()['field'].args.map(arg => arg.name)).toEqual(['keep']);
    expect((filtered.getType('IThing') as GraphQLInterfaceType).getFields()['field'].args.map(arg => arg.name)).toEqual(['keep']);
  });
});
