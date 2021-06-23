import { HeroGradient, InfoList } from '@theguild/components';

import { handlePushRoute } from '@guild-docs/client';

export default function Index() {
  return (
    <>
      <HeroGradient
        title="A set of utilities for faster development of GraphQL Schemas"
        description="GraphQL Tools is an npm package and an opinionated structure for how to build a GraphQL schema and resolvers in JavaScript, following the GraphQL-first development workflow."
        link={{
          children: 'Get Started',
          title: 'Learn more about GraphQL Tools',
          href: '/docs/introduction',
          onClick: e => handlePushRoute('/docs/introduction', e),
        }}
        version="v 7.0.5"
        colors={['#000246', '#184BE6']}
      />

      <InfoList
        title="Core features"
        items={[
          {
            title: 'The GraphQL-first philosophy',
            description:
              'Use the GraphQL schema definition language to generate a schema with full support for resolvers, interfaces, unions, and custom scalars.',
          },
          {
            title: 'Mock your GraphQL API',
            description:
              'With GraphQL Tools, you can mock your GraphQL API with fine-grained per-type mocking for fast prototyping without any datasources.',
          },
          {
            title: 'Stitch multiple GraphQL Schemas',
            description:
              'Automatically stitch multiple schemas together into one larger API in a simple, fast and powerful way.',
          },
        ]}
      />
    </>
  );
}
