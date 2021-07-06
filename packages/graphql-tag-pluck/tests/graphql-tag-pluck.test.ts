import { gqlPluckFromCodeString, gqlPluckFromCodeStringSync } from '../src';
import { freeText } from '../src/utils';
import { runTests } from '../../testing/utils';

describe('graphql-tag-pluck', () => {
  runTests({
    async: gqlPluckFromCodeString,
    sync: gqlPluckFromCodeStringSync
  })(pluck => {
    it('should allow to pluck without indentation changes', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `), {
        skipIndent: true
      });

      expect(sources.map(source => source.body).join('\n\n')).toMatchSnapshot();
    });

    it('should pluck graphql-tag template literals from .js file', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .js file when it has alias', async () => {
      const sources = await pluck('tmp-XXXXXX.ts', freeText(`
        import { default as foo } from 'graphql-tag'

        const fragment = foo(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = foo\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `), {
        modules: [
          {
            identifier: 'default',
            name: 'graphql-tag',
          }
        ]
      });

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .js file and remove replacements', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)
        const fragment2 = gql(\`
          fragment Foo2 on FooType {
            name
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
              ...Foo2
            }
          }

          \${fragment}
          \${fragment2}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        fragment Foo2 on FooType {
          name
        }

        query foo {
          foo {
            ...Foo
            ...Foo2
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .ts file', async () => {
      const sources = await pluck('tmp-XXXXXX.ts', freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        export namespace Fragments {
          interface EmptyObject {}

          const object = <EmptyObject> {}

          const fragment: Document = gql\`
            fragment Foo on FooType {
              id
            }
          \`

          const doc: Document = gql\`
            query foo {
              foo {
                ...Foo
              }
            }

            \${fragment}
          \`
        }
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .tsx file', async () => {
      const sources = await pluck('tmp-XXXXXX.tsx', freeText(`
        import * as React from 'react';
        import gql from 'graphql-tag';

        export default class extends React.Component<{}, {}> {
          public render() {
            return <div />;
          }
        }

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query IndexQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue JavaScript file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import Vue from 'vue'
        import gql from 'graphql-tag';

        export default Vue.extend({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue TS/Pug/SCSS file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import Vue from 'vue'
        import gql from 'graphql-tag';

        export default Vue.extend({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });
    it('should pluck graphql-tag template literals from .vue 3 JavaScript file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue 3 TS/Pug/SCSS file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent'
        })

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue 3 setup sugar JavaScript file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script setup>
        import gql from 'graphql-tag';


        const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue 3 setup sugar TS/Pug/SCSS file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script lang="ts" setup>
        import gql from 'graphql-tag';

        const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;

        // const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });
    it('should pluck graphql-tag template literals from .vue 3 outside setup sugar JavaScript file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import gql from 'graphql-tag';
        export const pageQuery = gql\`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script setup>
        </script>

        <style>
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue 3 outside setup sugar TS/Pug/SCSS file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import gql from 'graphql-tag';
        export const pageQuery = gql\`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
        \`;

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        import { defineComponent } from 'vue'
        export default defineComponent({
          name: 'TestComponent'
        })
        </script>
        <script lang="ts" setup>
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue 3 setup JavaScript file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template>
          <div>test</div>
        </template>

        <script>
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent',
          setup(){
            return {
              pageQuery: gql\`
              query IndexQuery {
                site {
                  siteMetadata {
                    title
                  }
                }
              }
            \`
            }
          }
        })

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style>
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .vue 3 setup TS/Pug/SCSS file', async () => {
      const sources = await pluck('tmp-XXXXXX.vue', freeText(`
        <template lang="pug">
          <div>test</div>
        </template>

        <script lang="ts">
        import { defineComponent } from 'vue'
        import gql from 'graphql-tag';

        export default defineComponent({
          name: 'TestComponent',
          setup(){
            return {
              pageQuery: gql\`
              query IndexQuery {
                site {
                  siteMetadata {
                    title
                  }
                }
              }
            \`
            }
          }
        })

        // export const pageQuery = gql\`
        //   query OtherQuery {
        //     site {
        //       siteMetadata {
        //         title
        //       }
        //     }
        //   }
        // \`;
        </script>

        <style lang="scss">
        .test { color: red };
        </style>
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .tsx file with generic jsx elements', async () => {
      const sources = await pluck('tmp-XXXXXX.tsx', freeText(`
        import * as React from 'react';
        import gql from 'graphql-tag';
        import Generic from './Generic'

        export default class extends React.Component<{}, {}> {
          public render() {
            return (
              <div>
                <Generic<string, number> />
                <Generic<undefined> />
                <Generic<null> />
              </div>
            )
          }
        }

        export const pageQuery = gql\`
          query IndexQuery {
            site {
              siteMetadata {
                title
              }
            }
          }
        \`;
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query IndexQuery {
          site {
            siteMetadata {
              title
            }
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .ts file with the same const inside namespace and outside namespace', async () => {
      const sources = await pluck('tmp-XXXXXX.ts', freeText(`
        import gql from 'graphql-tag';

        namespace Foo {
          export const foo = 12;

          export const query = gql\`
            query myQueryInNamespace {
              fieldA
            }
          \`;
        }

        interface ModuleWithProviders {
          ngModule: string;
        }

        export class FooModule {
          static forRoot() {
            return <ModuleWithProviders>{
              ngModule: 'foo',
              value: Foo.foo
            };
          }
        }

        export const query = gql\`
          query myQuery {
            fieldA
          }
        \`;
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        query myQueryInNamespace {
          fieldA
        }

        query myQuery {
          fieldA
        }
      `));
    });

    it('should pluck graphql-tag template literals from .flow file', async () => {
      const sources = await pluck('tmp-XXXXXX.flow', freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .js file with @flow header', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        // @flow

        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .js file with @flow strict-local', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        // @flow strict-local

        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should NOT pluck graphql-tag template literals from .js file without a @flow header', async () => {
      const fail = Error('Function did not throw');

      try {
        await pluck('tmp-XXXXXX.js', freeText(`
          import gql from 'graphql-tag'
          import { Document } from 'graphql'

          const fragment: Document = gql\`
            fragment Foo on FooType {
              id
            }
          \`

          const doc: Document = gql\`
            query foo {
              foo {
                ...Foo
              }
            }

            \${fragment}
          \`
        `));

        throw fail;
      }
      catch (e) {
        expect(e).not.toEqual(fail);
      }
    });

    it('should pluck graphql-tag template literals from .flow.jsx file', async () => {
      const sources = await pluck('tmp-XXXXXX.flow.jsx', freeText(`
        import gql from 'graphql-tag'
        import { Document } from 'graphql'

        const fragment: Document = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc: Document = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from .*.jsx file', async () => {
      const sources = await pluck('tmp-XXXXXX.mutation.jsx', freeText(`
        import gql from 'graphql-tag'

        const fragment = gql\`
          fragment Foo on FooType {
            id
          }
        \`

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals leaded by a magic comment from .js file', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        const Message = /* GraphQL */ \`
          enum MessageTypes {
            text
            media
            draftjs
          }\`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        enum MessageTypes {
          text
          media
          draftjs
        }
      `));
    });

    it('should pluck graphql-tag expression statements leaded by a magic comment from .js file', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        /* GraphQL */ \`
          enum MessageTypes {
            text
            media
            draftjs
          }\`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        enum MessageTypes {
          text
          media
          draftjs
        }
      `));
    });

    it(`should NOT pluck other template literals from a .js file`, async () => {
      const sources = await pluck(`tmp-XXXXXX.js`, freeText(`
        test(
          \`test1\`
        )
        test.test(
          \`test2\`
        )
        test\`
          test3
        \`
        test.test\`
          test4
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual('');
    });

    it('should pluck template literals when graphql-tag is imported differently', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import graphqltag from 'graphql-tag'

        const fragment = graphqltag(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = graphqltag\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck template literals from gql by default even if not imported from graphql-tag', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from code string', async () => {
      const sources = await pluck('test.js', freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql-tag template literals from a .js file', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import gql from 'graphql-tag'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should be able to specify the global GraphQL identifier name', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        const fragment = anothergql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = anothergql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `), {
        globalGqlIdentifierName: 'anothergql'
      });

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should be able to specify the GraphQL magic comment to look for', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        const Message = /* GQL */ \`
          enum MessageTypes {
            text
            media
            draftjs
          }\`
      `), {
        gqlMagicComment: 'GQL'
      });

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        enum MessageTypes {
          text
          media
          draftjs
        }
      `));
    });

    it('should be able to specify the package name of which the GraphQL identifier should be imported from', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import mygql from 'my-graphql-tag'

        const fragment = mygql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = mygql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `), {
        modules: [
          { name: 'my-graphql-tag' }
        ]
      });

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck graphql template literal from gatsby package', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import {graphql} from 'gatsby'

        const fragment = graphql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = graphql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck gql template literal from apollo-server-express package', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import { gql } from 'apollo-server-express'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck gql template literal from @apollo/client package', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        import { gql } from '@apollo/client'

        const fragment = gql(\`
          fragment Foo on FooType {
            id
          }
        \`)

        const doc = gql\`
          query foo {
            foo {
              ...Foo
            }
          }

          \${fragment}
        \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
        fragment Foo on FooType {
          id
        }

        query foo {
          foo {
            ...Foo
          }
        }
      `));
    });

    it('should pluck magic comment template literals with a trailing semicolon', async () => {
      const sources = await pluck('test.js', '/* GraphQL */ `{}`;');
      expect(sources.map(source => source.body).join('\n\n')).toEqual('{}');
    });

    it('should pluck with comments having escaped backticks', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
      import gql from 'graphql-tag';

      export default gql\`
        type User {
          id: ID!
          "Choose a nice username, so users can \\\`@mention\\\` you."
          username: String!
          email: String!
        }
      \`
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
          type User {
            id: ID!
            "Choose a nice username, so users can \`@mention\` you."
            username: String!
            email: String!
          }
      `));
    });

    it('should pluck graphql template literal imported lazily', async () => {
      const sources = await pluck('tmp-XXXXXX.js', freeText(`
        async function getUserType() {
          const graphql = await import('graphql-tag');

          return graphql\`
            type User {
              id: ID!
              "Choose a nice username, so users can \\\`@mention\\\` you."
              username: String!
              email: String!
            }
          \`
        }
      `));

      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(`
          type User {
            id: ID!
            "Choose a nice username, so users can \`@mention\` you."
            username: String!
            email: String!
          }
      `));
    });

    it('should pluck graphql template literal in a code file that has decorators', async () => {
      const sources = await pluck('tmp-XXXXXX.ts', freeText(`
        const CurrentUserForProfile = gql\`
          query CurrentUserForProfile {
            currentUser {
              login
              avatar_url
            }
          }
        \`;

        @Component({
          selector: 'app-dialog',
          template: 'test',
        })
        export class DialogComponent implements OnInit {
          constructor(
            public apollo: Apollo,
            @Inject(MAT_DIALOG_DATA) public data: any
          ) {}

          ngOnInit(): void {
            this.apollo
              .watchQuery<any>({
                query: CurrentUserForProfile,
              })
              .valueChanges.subscribe();
          }
        }
      `));


      expect(sources.map(source => source.body).join('\n\n')).toEqual(freeText(/* GraphQL */`
        query CurrentUserForProfile {
          currentUser {
            login
            avatar_url
          }
        }
      `));

    })
  });
});
