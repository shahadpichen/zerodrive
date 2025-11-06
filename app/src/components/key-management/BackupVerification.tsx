import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface BackupVerificationProps {
  mnemonic: string;
  onVerified: () => void;
}

interface HiddenWord {
  index: number;
  correctWord: string;
  options: string[];
}

// Common BIP39 words for generating wrong options
const COMMON_BIP39_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol'
];

export function BackupVerification({ mnemonic, onVerified }: BackupVerificationProps) {
  const [hiddenWords, setHiddenWords] = useState<HiddenWord[]>([]);
  const [selectedWords, setSelectedWords] = useState<Record<number, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const setupVerification = useCallback(() => {
    const words = mnemonic.trim().split(/\s+/);

    // Pick 3 random word indices to hide
    const wordCount = words.length;
    const indicesToHide: number[] = [];

    while (indicesToHide.length < 3) {
      const randomIndex = Math.floor(Math.random() * wordCount);
      if (!indicesToHide.includes(randomIndex)) {
        indicesToHide.push(randomIndex);
      }
    }

    // Generate options for each hidden word
    const hidden: HiddenWord[] = indicesToHide.map(index => {
      const correctWord = words[index];

      // Generate 3 wrong options
      const wrongOptions: string[] = [];
      while (wrongOptions.length < 3) {
        const randomWord = COMMON_BIP39_WORDS[
          Math.floor(Math.random() * COMMON_BIP39_WORDS.length)
        ];

        // Make sure it's not the correct word and not already added
        if (randomWord !== correctWord && !wrongOptions.includes(randomWord)) {
          wrongOptions.push(randomWord);
        }
      }

      // Shuffle all options
      const allOptions = [correctWord, ...wrongOptions];
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }

      return {
        index,
        correctWord,
        options: allOptions
      };
    });

    setHiddenWords(hidden.sort((a, b) => a.index - b.index));
    setSelectedWords({});
    setError("");
  }, [mnemonic]);

  useEffect(() => {
    setupVerification();
  }, [setupVerification]);

  const handleVerify = () => {
    setError("");
    setIsVerifying(true);

    // Check if all words are selected
    if (Object.keys(selectedWords).length < hiddenWords.length) {
      setError("Please select all missing words");
      setIsVerifying(false);
      return;
    }

    // Verify all selections are correct
    const allCorrect = hiddenWords.every(
      hw => selectedWords[hw.index] === hw.correctWord
    );

    setTimeout(() => {
      if (allCorrect) {
        toast.success("Backup verified successfully!", {
          description: "Your mnemonic phrase has been verified. Your key is ready to use.",
          duration: 5000,
        });
        onVerified();
      } else {
        setError("Some words are incorrect. Please check your backup and try again.");
        toast.error("Verification failed", {
          description: "Please double-check the words you selected.",
        });
      }
      setIsVerifying(false);
    }, 800); // Small delay for better UX
  };

  const getMnemonicWithBlanks = () => {
    const words = mnemonic.trim().split(/\s+/);
    return words.map((word, index) => {
      const hiddenWord = hiddenWords.find(hw => hw.index === index);

      if (hiddenWord) {
        return (
          <div key={index} className="inline-flex items-center gap-1 mx-1">
            <span className="text-muted-foreground text-xs">#{index + 1}</span>
            <Select
              value={selectedWords[index] || ""}
              onValueChange={(value) => {
                setSelectedWords(prev => ({ ...prev, [index]: value }));
                setError("");
              }}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {hiddenWord.options.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      return (
        <span key={index} className="inline-block mx-1 px-2 py-1 bg-muted rounded text-sm">
          <span className="text-muted-foreground text-xs mr-1">#{index + 1}</span>
          {word}
        </span>
      );
    });
  };

  return (
    <Card className="mt-4 border-2 border-primary">
      <CardHeader>
        <CardTitle>Verify Your Backup</CardTitle>
        <CardDescription>
          Select the missing words from your mnemonic phrase to verify you've saved it correctly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex flex-wrap items-center gap-y-3">
            {getMnemonicWithBlanks()}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md font-medium">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleVerify}
            disabled={isVerifying || Object.keys(selectedWords).length < hiddenWords.length}
            className="flex-1"
          >
            {isVerifying ? "Verifying..." : "Verify Backup"}
          </Button>
          <Button
            onClick={setupVerification}
            variant="outline"
            disabled={isVerifying}
          >
            New Words
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Can't remember? Go back and save your mnemonic phrase again.
        </p>
      </CardContent>
    </Card>
  );
}
