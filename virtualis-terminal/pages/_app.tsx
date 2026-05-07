// cogitatio-virtualis/virtualis-terminal/pages/_app.tsx

import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";
import "@/components/RoomScene/RoomScene.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta
          key="viewport"
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
