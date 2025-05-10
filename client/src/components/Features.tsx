import { Youtube, AudioWaveform, CloudDownload } from "lucide-react";

export default function Features() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
      <div className="bg-white rounded-xl p-6 shadow-card hover:shadow-lg transition-shadow">
        <div className="w-12 h-12 bg-primary/20 flex items-center justify-center rounded-lg mb-4">
          <Youtube className="text-primary w-6 h-6" />
        </div>
        <h3 className="font-poppins font-semibold text-xl mb-2">YouTube to Instrumental</h3>
        <p className="text-neutral-700">Extract clean instrumental tracks from any YouTube music video in seconds.</p>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-card hover:shadow-lg transition-shadow">
        <div className="w-12 h-12 bg-secondary/20 flex items-center justify-center rounded-lg mb-4">
          <AudioWaveform className="text-secondary w-6 h-6" />
        </div>
        <h3 className="font-poppins font-semibold text-xl mb-2">Key Transposition</h3>
        <p className="text-neutral-700">Change the musical key of any track to match your vocal range or instrument.</p>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-card hover:shadow-lg transition-shadow">
        <div className="w-12 h-12 bg-accent/20 flex items-center justify-center rounded-lg mb-4">
          <CloudDownload className="text-accent w-6 h-6" />
        </div>
        <h3 className="font-poppins font-semibold text-xl mb-2">Download & Share</h3>
        <p className="text-neutral-700">Download your processed tracks in high-quality audio formats to use anywhere.</p>
      </div>
    </section>
  );
}
