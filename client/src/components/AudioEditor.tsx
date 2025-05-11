import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, 
  Repeat, Plus, Minus, Music2, Waves, Drum, Settings2, RotateCcw, Sparkles, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useAudio } from '@/contexts/AudioContext';
import { formatTime } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
// import { TransposeDialog } from './TransposeDialog'; // Commented out for now
import { Input } from '@/components/ui/input';

export default function AudioEditor() {
  const { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration,
    play,
    pause,
    seek,
    downloadCurrentAudio,
    transposeCurrentAudio,
    processingStatus,
    processingProgress,
    error,
    isLoadingAudio,
    isInstrumentalActive,
    toggleInstrumentalMode,
    clearError,
  } = useAudio();
  
  const [fineTuneSemitones, setFineTuneSemitones] = useState(0);
  const { toast } = useToast();
  
  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      if (currentTrack) play();
      else toast({ title: 'No Track', description: 'Please load an audio track first.', variant: 'destructive' });
    }
  };
  
  const handleSeek = (value: number[]) => {
    if (currentTrack) seek(value[0]);
  };

  const handleApplyPitchChange = () => {
    if (!currentTrack) {
      toast({ title: 'Error', description: 'No track loaded to transpose.', variant: 'destructive' });
      return;
    }
    if (processingStatus === 'transposing' || isLoadingAudio) {
      toast({ title: 'Busy', description: 'Cannot transpose while another operation is in progress.', variant: 'default' });
      return;
    }
    transposeCurrentAudio(fineTuneSemitones);
  };
  
  const handleResetPitch = () => {
    if (!currentTrack) return;
    
    const previousSemitones = fineTuneSemitones;
    setFineTuneSemitones(0); // UI 리셋
    
    if (previousSemitones !== 0) { // 실제로 변경된 값이 있었을 때만 서버/컨텍스트에 요청
      transposeCurrentAudio(0); // 0 semitones로 리셋 요청
    }
  };
  
  const decreaseFineTune = () => {
    setFineTuneSemitones(prev => Math.max(prev - 1, -12)); // -12 ~ +12 범위 제한 예시
  };
  
  const increaseFineTune = () => {
    setFineTuneSemitones(prev => Math.min(prev + 1, 12));
  };

  useEffect(() => {
    if (error) {
      toast({ title: 'Audio Error', description: error, variant: 'destructive' });
      clearError();
    }
  }, [error, clearError, toast]);
  
  if (!currentTrack && !isLoadingAudio) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-card rounded-lg shadow-lg">
        <Music2 size={64} className="text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">No audio track loaded.</p>
        <p className="text-sm text-muted-foreground mt-1">Upload or select a track to begin editing.</p>
      </div>
    );
  }
  
  if (isLoadingAudio && !currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-card rounded-lg shadow-lg">
        <RotateCcw size={48} className="text-primary animate-spin mb-4" />
        <p className="text-lg text-primary">Loading audio...</p>
      </div>
    );
  }
  
  
  return (
    <div className="p-4 md:p-6 space-y-4 bg-card shadow-xl rounded-lg w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left w-full">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground truncate w-full" title={currentTrack?.title}>{currentTrack?.title || 'Loading...'}</h2>
          <p className="text-sm text-muted-foreground truncate" title={currentTrack?.artist || 'Unknown Artist'}>{currentTrack?.artist || 'Unknown Artist'}</p>
        </div>
      </div>
      
      {isLoadingAudio && (
        <div className="flex items-center justify-center p-2 bg-secondary/50 rounded-md">
          <RotateCcw size={16} className="text-primary animate-spin mr-2" />
          <span className="text-sm text-primary">Loading new audio source...</span>
        </div>
      )}
      
      <div className="space-y-3">
        <Slider
          value={[currentTime]}
          max={duration}
          step={0.1}
          onValueChange={handleSeek}
          disabled={!currentTrack || isLoadingAudio}
          className="w-full [&>span:first-child]:h-2 [&>span:first-child>span]:h-2
                     [&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:border-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-3">
        <Button variant="ghost" size="icon" onClick={handlePlayPause} disabled={!currentTrack || isLoadingAudio} className="h-14 w-14 rounded-full">
          {isPlaying ? <Pause size={32} /> : <Play size={32} />}
        </Button>
        <Button variant="ghost" size="icon" onClick={downloadCurrentAudio} disabled={!currentTrack || isLoadingAudio} className="h-14 w-14 rounded-full" title="Download Audio">
          <Download className="h-5 w-5" />
        </Button>
      </div>
      
      {/* 키 변경 (Transpose) UI 추가 */}
      {currentTrack && (
        <div className="pt-4 space-y-3">
          <Label className="text-base font-semibold">Key Transpose</Label>
          <div className="flex items-center justify-center space-x-2">
            <Button variant="outline" size="icon" onClick={decreaseFineTune} disabled={isLoadingAudio || processingStatus === 'transposing'}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={fineTuneSemitones}
              readOnly // 직접 입력보다는 버튼으로 조작
              className="w-16 text-center"
              aria-label="Semitones"
            />
            <Button variant="outline" size="icon" onClick={increaseFineTune} disabled={isLoadingAudio || processingStatus === 'transposing'}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <Button 
              onClick={handleApplyPitchChange} 
              disabled={isLoadingAudio || processingStatus === 'transposing' /* TODO: 현재 키 정보와 비교하여 비활성화 */}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Apply Key Change
            </Button>
            <Button variant="ghost" onClick={handleResetPitch} disabled={isLoadingAudio || processingStatus === 'transposing'}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset Key
            </Button>
          </div>
        </div>
      )}
      
      {/* Instrumental Toggle Switch - UI 개선 및 로직 명확화 */}
      {currentTrack && ( // currentTrack이 있을 때만 표시
        <div className="flex items-center justify-center space-x-3 pt-4">
          <Label htmlFor="instrumental-switch" className="text-sm font-medium">
            Original (Vocals)
          </Label>
          <Switch
            id="instrumental-switch"
            checked={isInstrumentalActive} // Instrumental 모드일 때 켜짐
            onCheckedChange={toggleInstrumentalMode}
            disabled={isLoadingAudio || processingStatus === 'processing' || processingStatus === 'transposing' || processingStatus === 'downloading'} // 로딩/처리 중 비활성화
          />
          <Label htmlFor="instrumental-switch" className="text-sm font-medium">
            Instrumental (MR)
          </Label>
        </div>
      )}
      
      {(processingStatus === 'processing' || processingStatus === 'downloading' || processingStatus === 'transposing') && (
        <div className="w-full bg-muted rounded-full h-2.5 dark:bg-gray-700 mt-4">
          <div
            className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: processingProgress + '%' }}
          ></div>
          <p className="text-xs text-center text-muted-foreground mt-1">{processingStatus} ({processingProgress}%)</p>
        </div>
      )}
      
      {/* <TransposeDialog 
        isOpen={isTransposeDialogOpen} 
        onOpenChange={setIsTransposeDialogOpen} 
      /> */}
    </div>
  );
}
