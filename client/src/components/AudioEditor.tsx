import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Repeat, Plus, Minus, Music2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useAudio } from '@/contexts/AudioContext';
import { audioProcessor } from '@/lib/audioProcessor';
import { musicalKeys, formatTime, calculateSemitones } from '@/lib/utils';
import { type ScaleType } from '@/lib/utils';

export default function AudioEditor() {
  const { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    playAudio, 
    pauseAudio, 
    seekAudio,
    downloadAudio,
    transposeAudio,
    processingStatus
  } = useAudio();
  
  const [selectedKey, setSelectedKey] = useState(currentTrack?.currentKey || 'C');
  const [selectedScale, setSelectedScale] = useState<ScaleType>(currentTrack?.currentScale || 'major');
  const [fineTuneSemitones, setFineTuneSemitones] = useState(0);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (currentTrack && waveformRef.current && !isInitialized) {
      initializeWaveform();
    }
    
    return () => {
      // Cleanup wavesurfer instance
      if (isInitialized) {
        audioProcessor.destroy();
        setIsInitialized(false);
      }
    };
  }, [currentTrack, waveformRef.current]);
  
  useEffect(() => {
    if (currentTrack) {
      setSelectedKey(currentTrack.currentKey);
      setSelectedScale(currentTrack.currentScale);
    }
  }, [currentTrack]);
  
  const initializeWaveform = async () => {
    if (!waveformRef.current || !currentTrack) return;
    
    try {
      await audioProcessor.initializeWaveform({
        container: waveformRef.current,
        waveColor: 'rgba(98, 0, 234, 0.4)',
        progressColor: 'rgba(98, 0, 234, 0.8)',
        url: currentTrack.url,
        height: 80,
        barWidth: 2,
        barRadius: 3
      });
      
      setDuration(audioProcessor.getDuration());
      setIsInitialized(true);
      
      audioProcessor.setOnTimeUpdateCallback((time) => {
        // Let the waveform handle its own time updates
      });
      
      audioProcessor.setOnFinishCallback(() => {
        pauseAudio();
      });
    } catch (error) {
      console.error('Error initializing waveform:', error);
    }
  };
  
  useEffect(() => {
    // Sync playing state with wavesurfer
    if (isInitialized) {
      if (isPlaying) {
        audioProcessor.play();
      } else {
        audioProcessor.pause();
      }
    }
  }, [isPlaying, isInitialized]);
  
  const handlePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekAudio(newTime);
    
    if (isInitialized) {
      audioProcessor.seekToTime(newTime);
    }
  };
  
  const handleRewind = () => {
    const newTime = Math.max(0, currentTime - 10);
    seekAudio(newTime);
    
    if (isInitialized) {
      audioProcessor.seekToTime(newTime);
    }
  };
  
  const handleForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    seekAudio(newTime);
    
    if (isInitialized) {
      audioProcessor.seekToTime(newTime);
    }
  };
  
  const handleKeySelect = (key: string) => {
    setSelectedKey(key);
  };
  
  const handleScaleChange = (value: string) => {
    setSelectedScale(value as ScaleType);
  };
  
  const handleApplyKeyChange = () => {
    if (!currentTrack) return;
    
    let semitones = 0;
    
    // Calculate exact semitones if we have original key information
    if (currentTrack.originalKey) {
      semitones = calculateSemitones(
        currentTrack.originalKey,
        selectedKey,
        currentTrack.originalScale,
        selectedScale
      );
    } else {
      // Otherwise use the fine-tune value
      semitones = fineTuneSemitones;
    }
    
    transposeAudio(currentTrack.id, selectedKey, selectedScale);
  };
  
  const handleDownload = () => {
    if (currentTrack) {
      downloadAudio(currentTrack.id);
    }
  };
  
  const handleResetToOriginal = () => {
    if (!currentTrack) return;
    
    setSelectedKey(currentTrack.originalKey);
    setSelectedScale(currentTrack.originalScale);
    setFineTuneSemitones(0);
    
    if (currentTrack.originalKey !== currentTrack.currentKey || 
        currentTrack.originalScale !== currentTrack.currentScale) {
      transposeAudio(currentTrack.id, currentTrack.originalKey, currentTrack.originalScale);
    }
  };
  
  const decreaseFineTune = () => {
    setFineTuneSemitones(prev => Math.max(prev - 1, -12));
  };
  
  const increaseFineTune = () => {
    setFineTuneSemitones(prev => Math.min(prev + 1, 12));
  };
  
  if (!currentTrack) return null;
  
  const isProcessing = processingStatus === 'processing' || processingStatus === 'transposing';
  
  return (
    <div>
      {/* Track Info */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <div className="flex-grow">
          <h3 className="font-poppins font-semibold text-xl">{currentTrack.title}</h3>
          <p className="text-neutral-600">{currentTrack.artist || 'Unknown Artist'}</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 text-neutral-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 6V12L16 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-700">
            <Music2 className="w-4 h-4" />
            <span>{currentTrack.originalKey} {currentTrack.originalScale}</span>
          </div>
        </div>
      </div>
      
      {/* Waveform Visualization */}
      <div className="waveform-container p-4 rounded-xl mb-6">
        <div 
          id="waveform" 
          ref={waveformRef}
          className="h-32 md:h-40 rounded-lg overflow-hidden bg-white bg-opacity-50"
        />
        
        {/* Playback Controls */}
        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">
              {formatTime(currentTime)}
            </span>
            <input 
              type="range" 
              className="audio-progress flex-grow" 
              min="0" 
              max={duration || 100} 
              value={currentTime || 0} 
              onChange={handleSeek}
              step="0.1"
            />
            <span className="text-sm text-neutral-600">
              {formatTime(duration)}
            </span>
          </div>
          <div className="flex justify-center gap-6">
            <button 
              className="text-neutral-700 hover:text-primary transition-colors"
              onClick={handleRewind}
              disabled={isProcessing}
            >
              <SkipBack className="w-6 h-6" />
            </button>
            <button 
              className={`h-12 w-12 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primary/90 transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handlePlayPause}
              disabled={isProcessing}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </button>
            <button 
              className="text-neutral-700 hover:text-primary transition-colors"
              onClick={handleForward}
              disabled={isProcessing}
            >
              <SkipForward className="w-6 h-6" />
            </button>
            <button 
              className="text-neutral-700 hover:text-primary transition-colors"
            >
              <Repeat className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Pitch & Key Controls */}
      <div className="mb-8">
        <h3 className="font-poppins font-medium text-lg mb-4">Adjust Musical Key</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Key Selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Select Key</label>
            <div className="key-selector mb-4">
              {musicalKeys.map((key) => (
                <button
                  key={key}
                  className={`py-2 border rounded-md text-sm font-medium transition-colors ${
                    selectedKey === key
                      ? 'bg-primary text-white border-primary'
                      : 'border-neutral-300 hover:border-primary hover:text-primary'
                  }`}
                  onClick={() => handleKeySelect(key)}
                  disabled={isProcessing}
                >
                  {key}
                </button>
              ))}
            </div>
            <RadioGroup 
              value={selectedScale} 
              onValueChange={handleScaleChange}
              className="flex gap-4 mb-2"
              disabled={isProcessing}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="major" id="major" />
                <Label htmlFor="major">Major</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="minor" id="minor" />
                <Label htmlFor="minor">Minor</Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-neutral-500">
              Original Key: {currentTrack.originalKey} {currentTrack.originalScale}
            </p>
          </div>
          
          {/* Pitch Control */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Fine Tune Pitch</label>
            <div className="flex items-center gap-4 mb-4">
              <button 
                className="h-10 w-10 rounded-full bg-neutral-200 flex items-center justify-center hover:bg-neutral-300 transition-colors"
                onClick={decreaseFineTune}
                disabled={fineTuneSemitones <= -12 || isProcessing}
              >
                <Minus className="text-neutral-700 w-4 h-4" />
              </button>
              <div className="flex-grow h-10 bg-neutral-100 rounded-lg relative">
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-neutral-300"></div>
                <div className="absolute inset-y-0 left-1/4 w-0.5 bg-neutral-200"></div>
                <div className="absolute inset-y-0 left-3/4 w-0.5 bg-neutral-200"></div>
                <div 
                  className="absolute top-0 bottom-0 flex items-center" 
                  style={{ 
                    left: `${((fineTuneSemitones + 12) / 24) * 100}%` 
                  }}
                >
                  <div className="h-8 w-4 bg-primary rounded-full -ml-2 cursor-move"></div>
                </div>
              </div>
              <button 
                className="h-10 w-10 rounded-full bg-neutral-200 flex items-center justify-center hover:bg-neutral-300 transition-colors"
                onClick={increaseFineTune}
                disabled={fineTuneSemitones >= 12 || isProcessing}
              >
                <Plus className="text-neutral-700 w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between text-sm text-neutral-600">
              <span>-12 semitones</span>
              <span>+12 semitones</span>
            </div>
            <p className="text-sm text-neutral-500 mt-2">
              Current adjustment: {fineTuneSemitones > 0 ? '+' : ''}{fineTuneSemitones} semitones
            </p>
          </div>
        </div>
      </div>
      
      {/* Apply Changes & Download */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button 
          className="bg-primary text-white hover:bg-primary/90 transition-colors flex-grow sm:flex-grow-0"
          onClick={handleApplyKeyChange}
          disabled={isProcessing}
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 17L15 12L9 7M15 12H3M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Apply Key Change
        </Button>
        <Button 
          className="bg-secondary text-white hover:bg-secondary/90 transition-colors flex-grow sm:flex-grow-0"
          onClick={handleDownload}
          disabled={isProcessing}
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V16M12 16L16 12M12 16L8 12M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download MP3
        </Button>
        <Button 
          variant="outline"
          className="bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors ml-auto hidden sm:block border-0"
          onClick={handleResetToOriginal}
          disabled={isProcessing}
        >
          Reset to Original
        </Button>
      </div>
    </div>
  );
}
