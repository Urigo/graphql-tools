import {
  GraphQLSchema,
  GraphQLFieldResolver,
  BuildSchemaOptions,
  GraphQLInputFieldConfig,
  GraphQLFieldConfig,
  FieldNode,
  FragmentDefinitionNode,
  SelectionNode,
  ObjectFieldNode,
  ObjectValueNode,
  GraphQLError,
  GraphQLEnumValueConfig,
} from 'graphql';
import { DelegationContext } from '@graphql-tools/delegate';
import { Executor, Subscriber, Request, Maybe } from '@graphql-tools/utils';

export interface IMakeRemoteExecutableSchemaOptions<TContext = Record<string, any>> {
  schema: GraphQLSchema | string;
  executor: Executor<TContext>;
  subscriber?: Subscriber<TContext>;
  createResolver?: (
    executor: Executor<TContext>,
    subscriber?: Subscriber<TContext> | undefined
  ) => GraphQLFieldResolver<any, TContext>;
  buildSchemaOptions?: BuildSchemaOptions;
}

export type InputFieldTransformer = (
  typeName: string,
  fieldName: string,
  inputFieldConfig: GraphQLInputFieldConfig
) => GraphQLInputFieldConfig | [string, GraphQLInputFieldConfig] | null | undefined;

export type InputFieldNodeTransformer = (
  typeName: string,
  fieldName: string,
  inputFieldNode: ObjectFieldNode,
  request: Request,
  delegationContext?: DelegationContext
) => ObjectFieldNode | Array<ObjectFieldNode>;

export type InputObjectNodeTransformer = (
  typeName: string,
  inputObjectNode: ObjectValueNode,
  request: Request,
  delegationContext?: DelegationContext
) => ObjectValueNode | undefined;

export type FieldTransformer<TContext = Record<string, any>> = (
  typeName: string,
  fieldName: string,
  fieldConfig: GraphQLFieldConfig<any, TContext>
) => Maybe<GraphQLFieldConfig<any, TContext> | [string, GraphQLFieldConfig<any, TContext>]>;

export type RootFieldTransformer<TContext = Record<string, any>> = (
  operation: 'Query' | 'Mutation' | 'Subscription',
  fieldName: string,
  fieldConfig: GraphQLFieldConfig<any, TContext>
) => Maybe<GraphQLFieldConfig<any, TContext> | [string, GraphQLFieldConfig<any, TContext>]>;

export type EnumValueTransformer = (
  typeName: string,
  externalValue: string,
  enumValueConfig: GraphQLEnumValueConfig
) => Maybe<GraphQLEnumValueConfig | [string, GraphQLEnumValueConfig]>;

export type FieldNodeTransformer = (
  typeName: string,
  fieldName: string,
  fieldNode: FieldNode,
  fragments: Record<string, FragmentDefinitionNode>,
  transformationContext: Record<string, any>
) => Maybe<SelectionNode | Array<SelectionNode>>;

export type LeafValueTransformer = (typeName: string, value: any) => any;

export type DataTransformer = (value: any, transformationContext: Record<string, any>) => any;

export type ObjectValueTransformerMap = Record<string, DataTransformer>;

export type ErrorsTransformer = (
  errors: ReadonlyArray<GraphQLError> | undefined,
  transformationContext: Record<string, any>
) => Array<GraphQLError> | undefined;
