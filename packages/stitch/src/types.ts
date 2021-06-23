import {
  GraphQLNamedType,
  GraphQLSchema,
  SelectionSetNode,
  FieldNode,
  GraphQLFieldConfig,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLInputFieldConfig,
  GraphQLInputObjectType,
  GraphQLEnumValueConfig,
  GraphQLEnumType,
} from 'graphql';
import { Maybe, TypeSource } from '@graphql-tools/utils';
import { Subschema, SubschemaConfig } from '@graphql-tools/delegate';
import { IExecutableSchemaDefinition } from '@graphql-tools/schema';

export interface MergeTypeCandidate<TContext = Record<string, any>> {
  type: GraphQLNamedType;
  subschema?: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  transformedSubschema?: Subschema<any, any, any, TContext>;
}

export interface MergeFieldConfigCandidate<TContext = Record<string, any>> {
  fieldConfig: GraphQLFieldConfig<any, TContext>;
  fieldName: string;
  type: GraphQLObjectType | GraphQLInterfaceType;
  subschema?: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  transformedSubschema?: Subschema<any, any, any, TContext>;
}

export interface MergeInputFieldConfigCandidate<TContext = Record<string, any>> {
  inputFieldConfig: GraphQLInputFieldConfig;
  fieldName: string;
  type: GraphQLInputObjectType;
  subschema?: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  transformedSubschema?: Subschema<any, any, any, TContext>;
}

export interface MergeEnumValueConfigCandidate<TContext = Record<string, any>> {
  enumValueConfig: GraphQLEnumValueConfig;
  enumValue: string;
  type: GraphQLEnumType;
  subschema?: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  transformedSubschema?: Subschema<any, any, any, TContext>;
}

export type MergeTypeFilter<TContext = Record<string, any>> = (
  mergeTypeCandidates: Array<MergeTypeCandidate<TContext>>,
  typeName: string
) => boolean;

export interface IStitchSchemasOptions<TContext = Record<string, any>>
  extends Omit<IExecutableSchemaDefinition<TContext>, 'typeDefs'> {
  subschemas?: Array<
    GraphQLSchema | SubschemaConfig<any, any, any, TContext> | Array<SubschemaConfig<any, any, any, TContext>>
  >;
  typeDefs?: TypeSource;
  types?: Array<GraphQLNamedType>;
  onTypeConflict?: OnTypeConflict<TContext>;
  mergeDirectives?: boolean | undefined;
  mergeTypes?: boolean | Array<string> | MergeTypeFilter<TContext>;
  typeMergingOptions?: TypeMergingOptions<TContext>;
  subschemaConfigTransforms?: Array<SubschemaConfigTransform<TContext>>;
}

export type SubschemaConfigTransform<TContext = Record<string, any>> = (
  subschemaConfig: SubschemaConfig<any, any, any, TContext>
) => SubschemaConfig<any, any, any, TContext> | Array<SubschemaConfig<any, any, any, TContext>>;

export interface TypeMergingOptions<TContext = Record<string, any>> {
  validationSettings?: ValidationSettings;
  validationScopes?: Record<string, ValidationSettings>;
  typeCandidateMerger?: (candidates: Array<MergeTypeCandidate<TContext>>) => MergeTypeCandidate<TContext>;
  typeDescriptionsMerger?: (candidates: Array<MergeTypeCandidate<TContext>>) => Maybe<string>;
  fieldConfigMerger?: (candidates: Array<MergeFieldConfigCandidate<TContext>>) => GraphQLFieldConfig<any, TContext>;
  inputFieldConfigMerger?: (candidates: Array<MergeInputFieldConfigCandidate<TContext>>) => GraphQLInputFieldConfig;
  enumValueConfigMerger?: (candidates: Array<MergeEnumValueConfigCandidate<TContext>>) => GraphQLEnumValueConfig;
}

export enum ValidationLevel {
  Error = 'error',
  Warn = 'warn',
  Off = 'off',
}

export interface ValidationSettings {
  validationLevel?: ValidationLevel;
  strictNullComparison?: boolean;
  proxiableScalars?: Record<string, Array<string>>;
}

export type OnTypeConflict<TContext = Record<string, any>> = (
  left: GraphQLNamedType,
  right: GraphQLNamedType,
  info?: {
    left: {
      subschema?: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
      transformedSubschema?: Subschema<any, any, any, TContext>;
    };
    right: {
      subschema?: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
      transformedSubschema?: Subschema<any, any, any, TContext>;
    };
  }
) => GraphQLNamedType;

declare module '@graphql-tools/utils' {
  interface IFieldResolverOptions<TSource = any, TContext = any, TArgs = any> {
    fragment?: string;
    selectionSet?: string | ((node: FieldNode) => SelectionSetNode);
  }
}
