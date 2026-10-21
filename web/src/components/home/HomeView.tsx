"use client";

/**
 * / — the public landing. Every section describes what the product
 * actually does today; the previews are built from the app's own
 * components fed illustration data (controllers/home.ts).
 */

import { MarketingFooter } from "@/components/ui/MarketingFooter";
import { MarketingNav } from "@/components/ui/MarketingNav";
import { useHomeController } from "@/controllers/home";
import {
  ArchitectureSection,
  FaqSection,
  FeaturesSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  SelfHostSection,
  ShowcaseSection,
} from "./sections";

export function HomeView() {
  const { stars, demo, onGetStarted } = useHomeController();

  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      <MarketingNav starCount={stars} onTryCloud={onGetStarted} />
      <main>
        <HeroSection demo={demo} onGetStarted={onGetStarted} />
        <HowItWorksSection />
        <FeaturesSection />
        <ShowcaseSection demo={demo} />
        <ArchitectureSection />
        <SelfHostSection />
        <FaqSection />
        <FinalCtaSection onGetStarted={onGetStarted} />
      </main>
      <MarketingFooter />
    </div>
  );
}
