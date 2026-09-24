import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Brand } from "./brand";
import { ModernNavigation } from "./modern-navigation";
import { ModeToggle } from "../components/mode-toggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";

/** Development-only visual fixture. No credentials, API requests, or file operations. */
export function ComponentPreview() {
  const [value, setValue] = useState("");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ModernNavigation />
      <div className="modern-app-content">
        <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
          <header className="flex items-center justify-between">
            <Brand />
            <ModeToggle />
          </header>
          <div>
            <h1 className="text-3xl">Appearance preview</h1>
            <p className="mt-2 text-muted-foreground">
              Development fixture · sample content only.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Your next step</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p>
                Switch interface styles while editing this sample field. Its
                value should remain unchanged.
              </p>
              <label className="block space-y-2">
                <span>Sample filename</span>
                <Input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Weekend memories"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button>Upload file</Button>
                <Button variant="outline">Choose folder</Button>
                <Button variant="destructive">Delete sample</Button>
                <Button disabled>Unavailable</Button>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open sample dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Presentation stays in sync</DialogTitle>
                  <DialogDescription>
                    This portaled dialog uses the same interface and color
                    preferences.
                  </DialogDescription>
                  <ModeToggle />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3 rounded-lg border p-4">
              <CheckCircle2 className="shrink-0 text-green-600 dark:text-green-400" />
              <span>Success: sample complete</span>
            </div>
            <div className="flex gap-3 rounded-lg border p-4">
              <AlertTriangle className="shrink-0 text-amber-700 dark:text-amber-300" />
              <span>Warning: action needed</span>
            </div>
            <div className="flex gap-3 rounded-lg border p-4">
              <XCircle className="shrink-0 text-red-600 dark:text-red-400" />
              <span>Error: please retry</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
