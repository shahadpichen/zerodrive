import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { getStoredKey } from '../../utils/cryptoUtils';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export function DeviceManagement() {
  const [hasKey, setHasKey] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    setIsChecking(true);
    try {
      const key = await getStoredKey();
      setHasKey(!!key);
    } catch (error) {
      setHasKey(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Using ZeroDrive on Other Devices</CardTitle>
          <CardDescription>Checking your key status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Using ZeroDrive on Other Devices</CardTitle>
        <CardDescription>
          Your key is saved on this device. Here's how to access your files from other devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Storage Status */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Where is your key?</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {hasKey ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm">
                {hasKey ? 'Saved securely on this device ✓' : 'No key found on this device'}
              </span>
            </div>
            {hasKey && (
              <p className="text-xs text-muted-foreground ml-6">
                Your key is saved safely in your browser and never leaves this device.
              </p>
            )}
          </div>
        </div>

        {/* Sync Information */}
        {hasKey && (
          <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-md bg-blue-50 dark:bg-blue-950/20">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  How to use your files on another device:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
                  <li>On this computer/phone: Save your backup phrase (the 12 words shown above) somewhere safe</li>
                  <li>On your other device: Open ZeroDrive and click "I already have a backup phrase"</li>
                  <li>Type in the same 12 words you saved earlier</li>
                  <li>That's it! Your files will appear on that device too</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Storage Information */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Important:</strong> Your key stays on this device and is never sent anywhere.
            To use ZeroDrive on another device, you'll need to enter your backup phrase there.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
