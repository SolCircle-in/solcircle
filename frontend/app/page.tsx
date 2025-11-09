'use client'

import { Hero } from "@/components/hero";
import { AnimatedFeaturesSection } from "@/components/animated-features-section";
import { FAQSection } from "@/components/faq-section";
import { AnimatedCTASection } from "@/components/animated-cta-section";
import { Footer } from "@/components/footer";
import { Leva } from "leva";

export default function Home() {
  return (
    <>
      <Hero />
      <AnimatedFeaturesSection />
      <FAQSection />
      <AnimatedCTASection />
      <Footer />
      <Leva hidden />
    </>
  );
}
