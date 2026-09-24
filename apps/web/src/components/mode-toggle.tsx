import { Palette } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "./theme-provider";
import { ColorMode, InterfaceStyle } from "../appearance/preferences";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./ui/dropdown-menu";

export function ModeToggle() {
  const { theme, setTheme, interfaceStyle, setInterfaceStyle } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Appearance settings"
          title="Appearance settings"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Interface style</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={interfaceStyle}
          onValueChange={(value) => setInterfaceStyle(value as InterfaceStyle)}
        >
          <DropdownMenuRadioItem value="creator">
            Creator’s choice
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="modern">Modern</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Color mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as ColorMode)}
        >
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
