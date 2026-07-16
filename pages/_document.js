import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="description" content="NotDore - Kho tài liệu pháp luật" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css?family=Quicksand:700|Roboto:400,400i,700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
