import { useCallback, useState } from "react";
import { Preloader } from "./components/Preloader";
import { Cursor } from "./components/Cursor";
import { Nav } from "./components/Nav";
import { HeroScene } from "./components/three/HeroScene";
import { Hero } from "./components/sections/Hero";
import { Services } from "./components/sections/Services";
import { Statement } from "./components/sections/Statement";
import { Automation } from "./components/sections/Automation";
import { Stack } from "./components/sections/Stack";
import { Process } from "./components/sections/Process";
import { Work } from "./components/sections/Work";
import { Pricing } from "./components/sections/Pricing";
import { Faq } from "./components/sections/Faq";
import { Contact } from "./components/sections/Contact";
import { Footer } from "./components/sections/Footer";
import { useSmoothScroll } from "./hooks/useSmoothScroll";

export default function App() {
  const [ready, setReady] = useState(false);
  useSmoothScroll();

  const handleLoaded = useCallback(() => setReady(true), []);

  return (
    <>
      <Preloader onDone={handleLoaded} />
      <Cursor />
      <Nav />

      {/* Persistent WebGL backdrop — fades out once the hero scrolls away. */}
      <HeroScene />

      <main>
        <Hero ready={ready} />
        <Services />
        <Statement />
        <Automation />
        <Stack />
        <Process />
        <Work />
        <Pricing />
        <Faq />
        <Contact />
      </main>

      <Footer />

      {/* Film grain over the whole page */}
      <div
        aria-hidden="true"
        className="noise pointer-events-none fixed inset-0 z-[150] opacity-[0.028] mix-blend-overlay"
      />
    </>
  );
}
