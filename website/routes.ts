import { IRoutes, GenerateRoutes } from '@guild-docs/server';

export function getRoutes(): IRoutes {
  const Routes: IRoutes = {
    _: {
      docs: {
        $routes: ['introduction'],
        _: {
          guides: {
            $name: 'Guides',
            $routes: [
              'generate-schema',
              'resolvers',
              'resolvers-composition',
              'scalars',
              'mocking',
              'connectors',
              'schema-directives',
              'directive-resolvers',
              'schema-delegation',
              'remote-schemas',
              'schema-wrapping',
              'schema-merging',
              '$schema-stitching',
              'server-setup',
              'schema-loading',
              'documents-loading',
              'graphql-tag-pluck',
              'relay-operation-optimizer',
              '$migration',
            ],
          },
        },
      },
    },
  };
  GenerateRoutes({
    Routes,
    folderPattern: 'docs',
    basePath: 'docs',
    basePathLabel: 'Documentation',
  });

  return Routes;
}
