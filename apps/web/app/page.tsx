import { Navbar } from '../components/landing/Navbar';
import { Hero } from '../components/landing/Hero';
import { DianShowcase } from '../components/landing/DianShowcase';
import { ModulesSection } from '../components/landing/ModulesSection';
import { PricingSection } from '../components/landing/PricingSection';
import { Footer } from '../components/landing/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <DianShowcase />
        <ModulesSection />
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}
