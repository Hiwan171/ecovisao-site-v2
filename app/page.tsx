import { HeroExperience } from "@/components/hero/hero-experience";
import { Footer } from "@/components/footer/footer";
import { SmoothScroll } from "@/components/smooth-scroll/smooth-scroll";

export default function Home() {
  return (
    <SmoothScroll>
      <main>
        <HeroExperience />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
