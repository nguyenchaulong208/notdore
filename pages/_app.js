import Script from 'next/script';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Script src="/assets/plugins/popper.min.js" strategy="beforeInteractive" />
      <Script src="/assets/plugins/bootstrap/js/bootstrap.min.js" strategy="beforeInteractive" />
      <Script src="/assets/plugins/smoothscroll.min.js" strategy="beforeInteractive" />
      <Script src="/assets/js/main.js" strategy="afterInteractive" />
      <Component {...pageProps} />
    </>
  );
}
