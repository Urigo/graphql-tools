export { wrapSchema } from './wrapSchema';
export { transformSchema } from './transformSchema';

export { defaultCreateProxyingResolver } from './generateProxyingResolvers';

export * from './transforms/index';

export {
  default as makeRemoteExecutableSchema,
  defaultCreateRemoteResolver,
  defaultCreateRemoteSubscriptionResolver,
} from './makeRemoteExecutableSchema';
