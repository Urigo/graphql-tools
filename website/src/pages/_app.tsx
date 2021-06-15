import 'remark-admonitions/styles/infima.css';
import 'prism-themes/themes/prism-atom-dark.css';
import '../../public/style.css';

import { appWithTranslation } from 'next-i18next';

import { extendTheme, theme as chakraTheme } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';
import { ExtendComponents, handlePushRoute, CombinedThemeProvider, DocsPage, AppSeoProps } from '@guild-docs/client';
import { Header, Subheader, Footer } from '@theguild/components';

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
            title: 'Learn more about Envelop',
            href: '/docs/introduction',
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
          title: 'Learn more about GraphQL Tools',
          href: '/docs/introduction',
          onClick: e => handlePushRoute('/docs/introduction', e),
        }}
      />
      {isDocs ? (
        <DocsPage appProps={appProps} accentColor={accentColor} mdxRoutes={mdxRoutes} />
      ) : (
        <Component {...pageProps} />
      )}
      <Footer />
    </>
  );
}

const AppContentWrapper = appWithTranslation(function TranslatedApp(appProps) {
  return <AppContent {...appProps} />;
});

const defaultSeo: AppSeoProps = {
  title: 'Guild Docs',
  description: 'Guild Docs Example',
  logo: {
    url: 'https://the-guild-docs.vercel.app/assets/subheader-logo.png',
    width: 50,
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
