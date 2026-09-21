import { HeroExperience } from "@/components/hero/hero-experience";
import { SmoothScroll } from "@/components/smooth-scroll/smooth-scroll";

export default function Home() {
  return (
    <main>
      <SmoothScroll>
        <HeroExperience />
      </SmoothScroll>
    </main>
  );
}
