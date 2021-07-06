import 'remark-admonitions/styles/infima.css';
import 'prism-themes/themes/prism-atom-dark.css';
import '../../public/style.css';

import { appWithTranslation } from 'next-i18next';

import { extendTheme, theme as chakraTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';
import { ExtendComponents, handlePushRoute, CombinedThemeProvider, DocsPage, AppSeoProps } from '@guild-docs/client';
import { Header, Subheader, FooterExtended } from '@theguild/components';

import type { AppProps } from 'next/app';

ExtendComponents({
  HelloWorld() {
    return <p>Hello World!</p>;
  },
});

const styles: typeof chakraTheme['styles'] = {
  global: props => ({
    body: {
      bg: mode('white', 'gray.850')(props),
    },
  }),
};

const theme = extendTheme({
  colors: {
    gray: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      850: '#1b1b1b',
      900: '#171717',
    },
  },
  fonts: {
    heading: '"Poppins", sans-serif',
    body: '"Poppins", sans-serif',
  },
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  styles,
});

const accentColor = '#184BE6';

const serializedMdx = process.env.SERIALIZED_MDX_ROUTES;
const mdxRoutes = { data: serializedMdx && JSON.parse(serializedMdx) };

function AppContent(appProps: AppProps) {
  const { Component, pageProps, router } = appProps;
  const isDocs = router.asPath.startsWith('/docs');

  return (
    <>
      <Header accentColor={accentColor} activeLink="/open-source" themeSwitch />
      <Subheader
        activeLink={router.asPath}
        product={{
          title: 'GraphQL Tools',
          description: 'A set of utilities for faster GraphQL development',
          image: {
            src: 'https://the-guild.dev/static/shared-logos/products/tools.svg',
            alt: 'GraphQL Tools',
          },
          onClick: e => handlePushRoute('/', e),
        }}
        links={[
          {
            children: 'Home',
            title: 'Visit our Homepage',
            href: '/',
            onClick: e => handlePushRoute('/', e),
          },
          {
            children: 'API & Doc',
            title: 'Learn more about GraphQL Tools',
            href: '/docs',
            onClick: e => handlePushRoute('/docs/introduction', e),
          },
          {
            children: 'Github',
            title: 'See our Github profile',
            href: 'https://github.com/ardatan/graphql-tools',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        ]}
        cta={{
          children: 'Get Started',
          title: 'Begin your journey with GraphQL Tools',
          href: '/docs/introduction',
          onClick: e => handlePushRoute('/docs/introduction', e),
        }}
      />
      {isDocs ? (
        <DocsPage appProps={appProps} accentColor={accentColor} mdxRoutes={mdxRoutes} />
      ) : (
        <Component {...pageProps} />
      )}
      <FooterExtended
        resources={[
          {
            children: 'Get Started',
            title: 'Begin your journey with GraphQL Tools',
            href: '/docs/introduction',
            onClick: e => handlePushRoute('/docs/introduction', e),
          },
          {
            children: 'Guides',
            title: 'Read about the Guides',
            href: '/docs/guides/generate-schema',
            onClick: e => handlePushRoute('/docs/guides/generate-schema', e),
          },
          {
            children: 'Modules (API)',
            title: 'Read about the Modules',
            href: '/docs/api/modules/batch_delegate_src',
            onClick: e => handlePushRoute('/docs/api/modules/batch_delegate_src', e),
          },
          {
            children: 'Classes (API)',
            title: 'Read about the Classes',
            href: '/docs/api/classes/delegate_src.addargumentsasvariables',
            onClick: e => handlePushRoute('/docs/api/classes/delegate_src.addargumentsasvariables', e),
          },
          {
            children: 'Interfaces (API)',
            title: 'Read about the Interfaces',
            href: '/docs/api/interfaces/loaders_apollo_engine_src.apolloengineoptions',
            onClick: e => handlePushRoute('/docs/api/interfaces/loaders_apollo_engine_src.apolloengineoptions', e),
          },
          {
            children: 'Enums (API)',
            title: 'Read about the Enums',
            href: '/docs/api/enums/merge_src.compareval',
            onClick: e => handlePushRoute('/docs/api/enums/merge_src.compareval', e),
          },
        ]}
      />
    </>
  );
}

const AppContentWrapper = appWithTranslation(function TranslatedApp(appProps) {
  return <AppContent {...appProps} />;
});

const defaultSeo: AppSeoProps = {
  title: 'GraphQL Tools',
  description: 'A set of utilities for faster GraphQL development',
  logo: {
    url: 'https://the-guild.dev/static/shared-logos/products/tools.svg',
    width: 54,
    height: 54,
  },
};

export default function App(appProps: AppProps) {
  return (
    <CombinedThemeProvider theme={theme} accentColor={accentColor} defaultSeo={defaultSeo}>
      <AppContentWrapper {...appProps} />
    </CombinedThemeProvider>
  );
}
