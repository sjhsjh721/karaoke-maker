import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Hero() {
  const scrollToApp = () => {
    const appSection = document.getElementById('app-section');
    if (appSection) {
      appSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-12 text-center">
      <h1 className="font-poppins font-bold text-4xl md:text-5xl mb-4 text-neutral-900">
        Extract <span className="text-primary">Instrumentals</span> &<br className="hidden md:inline" /> 
        Transform <span className="text-accent">Music</span>
      </h1>
      <p className="text-neutral-700 text-lg max-w-2xl mx-auto mb-8">
        Extract instrumental tracks from YouTube videos and transpose them to different musical keys in seconds.
      </p>
      <div className="flex justify-center gap-4 flex-wrap">
        <Button 
          size="lg" 
          onClick={scrollToApp}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Get Started
        </Button>
        <Link href="#how-it-works">
          <Button 
            variant="outline" 
            size="lg"
            className="bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors border-0"
          >
            How It Works
          </Button>
        </Link>
      </div>
    </section>
  );
}
