import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (transcript: string) => void;
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = "",
}) => {
  const [listening, setListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback simulated voice prompt
      const spoken = prompt("Speak math expression (e.g. '15 times 4 plus 10'):");
      if (spoken) {
        onTranscript(spoken);
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        onTranscript(text);
      };

      recognition.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={`h-9 w-9 shrink-0 rounded-xl ${listening ? "bg-red-500/10 text-red-500 border-red-500/30 animate-pulse" : ""} ${className}`}
      onClick={startListening}
      title="Voice Math Dictation"
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
};
