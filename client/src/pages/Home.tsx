import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Testimonials from '@/components/Testimonials';
import YouTubeInput from '@/components/YouTubeInput';
import ProcessingStatus from '@/components/ProcessingStatus';
import AudioEditor from '@/components/AudioEditor';
import EmptyState from '@/components/EmptyState';
import { useAudio } from '@/contexts/AudioContext';
import { Card, CardContent } from '@/components/ui/card';
import { Helmet } from 'react-helmet';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const { currentTrack, processingStatus } = useAudio();
  
  const handleVideoSelect = (url: string) => {
    setYoutubeUrl(url);
    
    // Find the input element and set its value
    const inputElement = document.getElementById('youtube-link') as HTMLInputElement;
    if (inputElement) {
      inputElement.value = url;
      // Focus on the input to indicate to the user that they can now submit
      inputElement.focus();
    }
  };
  
  const showEmptyState = !currentTrack && processingStatus === 'idle';
  const showAudioEditor = currentTrack && processingStatus !== 'downloading' && processingStatus !== 'processing';
  
  return (
    <>
      <Helmet>
        <title>Karaoke Maker - Extract Instrumentals & Transform Music</title>
        <meta name="description" content="Extract instrumental tracks from YouTube videos and transpose them to different musical keys in seconds with Karaoke Maker." />
        <meta property="og:title" content="Karaoke Maker - Extract Instrumentals & Transform Music" />
        <meta property="og:description" content="Turn any YouTube song into an instrumental track and change its key with our easy-to-use audio processing tool." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
      </Helmet>
    
      <div className="flex flex-col min-h-screen">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-6xl flex-grow">
          <Hero />
          <Features />
          
          <section className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-16" id="app-section">
            <h2 className="font-poppins font-bold text-2xl mb-6 text-neutral-900">Process Your Track</h2>
            
            <YouTubeInput />
            <ProcessingStatus />
            
            {showAudioEditor && (
              <AudioEditor />
            )}
            
            {showEmptyState && (
              <EmptyState onVideoSelect={handleVideoSelect} />
            )}
          </section>
          
          <HowItWorks />
          <Testimonials />
        </main>
        
        <Footer />
      </div>
    </>
  );
}
