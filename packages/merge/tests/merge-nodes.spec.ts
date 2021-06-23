import { mergeGraphQLNodes } from '../src';
import { parse, InputObjectTypeDefinitionNode } from 'graphql';
import { assertEnumTypeDefinitionNode, assertInputObjectTypeDefinitionNode, assertInterfaceTypeDefinitionNode, assertNamedTypeNode, assertObjectTypeDefinitionNode, assertScalarTypeDefinitionNode, assertUnionTypeDefinitionNode } from '../../testing/assertion';
import { assertSome } from '@graphql-tools/utils';

describe('Merge Nodes', () => {
  describe('type', () => {
    it('Should merge two GraphQL types correctly when one of them is empty', () => {
      const type1 = parse(`type A { f1: String }`);
      const type2 = parse(`type A`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.fields)
      expect(type.fields.length).toBe(1);
      expect(type.fields[0].name.value).toBe('f1');
      assertNamedTypeNode(type.fields[0].type)
      expect(type.fields[0].type.name.value).toBe('String');
    });

    it('Should merge two GraphQL Types correctly', () => {
      const type1 = parse(`type A { f1: String }`);
      const type2 = parse(`type A { f2: Int }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.fields)

      expect(type.fields.length).toBe(2);
      expect(type.fields[0].name.value).toBe('f1');
      expect(type.fields[1].name.value).toBe('f2');
      assertNamedTypeNode(type.fields[0].type)
      expect(type.fields[0].type.name.value).toBe('String');
      assertNamedTypeNode(type.fields[1].type)
      expect(type.fields[1].type.name.value).toBe('Int');
    });

    it('Should merge two GraphQL Types correctly when they have shared fields', () => {
      const type1 = parse(`type A { f1: String }`);
      const type2 = parse(`type A { f1: String, f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.fields)

      expect(type.fields.length).toBe(2);
      expect(type.fields[0].name.value).toBe('f1');
      expect(type.fields[1].name.value).toBe('f2');
      assertNamedTypeNode(type.fields[0].type)
      expect(type.fields[0].type.name.value).toBe('String');
      assertNamedTypeNode(type.fields[1].type)
      expect(type.fields[1].type.name.value).toBe('Int');
    });

    it('Should merge GraphQL Types that extends the same interface', () => {
      const type1 = parse(`interface Base { f1: String } type A implements Base { f1: String }`);
      const type2 = parse(`interface Base { f1: String } type A implements Base { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.interfaces)

      expect(type.interfaces.length).toBe(1);
      expect(type.interfaces[0].name.value).toBe('Base');
    });

    it('Should merge GraphQL Types that has interface and then override without it', () => {
      const type1 = parse(`interface Base { f1: String } type A implements Base { f1: String }`);
      const type2 = parse(`type A { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type  = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.interfaces)

      expect(type.interfaces.length).toBe(1);
      expect(type.interfaces[0].name.value).toBe('Base');
    });

    it('Should merge GraphQL Types and preserve directives and not override', () => {
      const type1 = parse(`type A @test { f1: String }`);
      const type2 = parse(`type A { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.directives)

      expect(type.directives.length).toBe(1);
      expect(type.directives[0].name.value).toBe('test');
    });

    it('Should merge GraphQL Types and preserve directives and merge multiple', () => {
      const type1 = parse(`type A @test { f1: String }`);
      const type2 = parse(`type A @other { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.directives)

      expect(type.directives.length).toBe(2);
      expect(type.directives[0].name.value).toBe('test');
      expect(type.directives[1].name.value).toBe('other');
    });

    it('Should merge GraphQL Types and preserve directives', () => {
      const type1 = parse(`type A @test { f1: String }`);
      const type2 = parse(`type A @test { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.directives)

      expect(type.directives.length).toBe(1);
      expect(type.directives[0].name.value).toBe('test');
    });

    it('Should merge GraphQL Types and merge directives', () => {
      const type1 = parse(`type A @test { f1: String }`);
      const type2 = parse(`type A @test2 { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.directives)

      expect(type.directives.length).toBe(2);
      expect(type.directives[0].name.value).toBe('test');
      expect(type.directives[1].name.value).toBe('test2');
    });

    it('Should merge GraphQL Types and merge directives (reversed)', () => {
      const type1 = parse(`type A @test { f1: String }`);
      const type2 = parse(`type A @test2 { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions], {
        reverseDirectives: true,
      });
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.directives)

      expect(type.directives.length).toBe(2);
      expect(type.directives[0].name.value).toBe('test2');
      expect(type.directives[1].name.value).toBe('test');
    });

    it('Should merge GraphQL Types that extends the different interfaces', () => {
      const type1 = parse(`interface Base1 { f1: String } type A implements Base1 { f1: String }`);
      const type2 = parse(`interface Base2 { f2: Int } type A implements Base2 { f2: Int}`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.A;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.interfaces)

      expect(type.interfaces.length).toBe(2);
      expect(type.interfaces[0].name.value).toBe('Base1');
      expect(type.interfaces[1].name.value).toBe('Base2');
    });

    it('Should merge two GraphQL Types correctly when they have a conflict', () => {
      const type1 = parse(`type A { f1: String }`);
      const type2 = parse(`type A { f1: Int }`);
      const mergedFn = () => mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);

      expect(mergedFn).toThrowError('Unable to merge GraphQL type "A": Field "f1" already defined with a different type. Declared as "String", but you tried to override with "Int"');
    });
  });

  describe('enum', () => {
    it('should merge different enums values', () => {
      const type1 = parse(`enum A { T }`);
      const type2 = parse(`enum A { S }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A
      assertEnumTypeDefinitionNode(result)
      assertSome(result.values)
      expect(result.values.length).toBe(2);
      expect(result.values.findIndex(v => v.name.value === 'T')).not.toBe(-1);
      expect(result.values.findIndex(v => v.name.value === 'S')).not.toBe(-1);
    });

    it('should merge different same values', () => {
      const type1 = parse(`enum A { T }`);
      const type2 = parse(`enum A { T }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A;
      assertEnumTypeDefinitionNode(result)
      assertSome(result.values)

      expect(result.values.length).toBe(1);
      expect(result.values[0].name.value).toBe('T');
    });

    it('should merge directives correctly', () => {
      const type1 = parse(`enum A @test { T }`);
      const type2 = parse(`enum A @test2 { T }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A;
      assertEnumTypeDefinitionNode(result)
      assertSome(result.directives)

      expect(result.directives.length).toBe(2);
      expect(result.directives[0].name.value).toBe('test');
      expect(result.directives[1].name.value).toBe('test2');
    });

    it('should merge directives correctly when only one defined', () => {
      const type1 = parse(`enum A @test { T }`);
      const type2 = parse(`enum A { S }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A;
      assertEnumTypeDefinitionNode(result)
      assertSome(result.directives)

      expect(result.directives.length).toBe(1);
      expect(result.directives[0].name.value).toBe('test');
    });
  });

  describe('union', () => {
    it('should merge unions possible types', () => {
      const type1 = parse(`type A union C = A`);
      const type2 = parse(`type B union C = B`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.C;
      assertUnionTypeDefinitionNode(result)
      assertSome(result.types)

      expect(result.types.length).toBe(2);
      expect(result.types[0].name.value).toBe('A');
      expect(result.types[1].name.value).toBe('B');
    });
  });

  describe('scalar', () => {
    it('should merge scalar with the same type', () => {
      const type1 = parse(`scalar A`);
      const type2 = parse(`scalar A`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A;
      assertScalarTypeDefinitionNode(result)

      expect(result.name.value).toBe('A');
    });
  });

  describe('input', () => {
    it('should merge input', () => {
      const type1 = parse(`input A { f1: String }`);
      const type2 = parse(`input A { f2: String }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A;
      assertInputObjectTypeDefinitionNode(result)
      assertSome(result.fields)

      expect(result.fields.length).toBe(2);
      expect(result.fields[0].name.value).toBe('f1');
      expect(result.fields[1].name.value).toBe('f2');
    });

    it('should merge input and prefer NonNullable over Nullable', () => {
      const type1 = parse(`input A { f1: String }`);
      const type2 = parse(`input A { f1: String! }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const result = merged.A;
      assertInputObjectTypeDefinitionNode(result)
      assertSome(result.fields)

      expect(result.fields.length).toBe(1);
      expect(result.fields[0].name.value).toBe('f1');
      expect(result.fields[0].type.kind).toBe('NonNullType');
    });
  });

  describe('schema', () => {
    it('should merge Query type correctly', () => {
      const type1 = parse(`type Query { f1: String }`);
      const type2 = parse(`type Query { f2: String }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      const type = merged.Query;
      assertObjectTypeDefinitionNode(type)
      assertSome(type.fields)

      expect(type.fields.length).toBe(2);
      expect(type.fields[0].name.value).toBe('f1');
      expect(type.fields[1].name.value).toBe('f2');
      assertNamedTypeNode(type.fields[0].type)
      expect(type.fields[0].type.name.value).toBe('String');
      assertNamedTypeNode(type.fields[1].type)
      expect(type.fields[1].type.name.value).toBe('String');
    });

    it.skip('should remove schema definition', () => {
      const type1 = parse(`schema { query: Query } type Query { f1: String }`);
      const type2 = parse(`type Query { f2: String }`);
      const merged = mergeGraphQLNodes([...type1.definitions, ...type2.definitions]);
      expect(Object.values(merged).length).toBe(1);
    });
  });
});
