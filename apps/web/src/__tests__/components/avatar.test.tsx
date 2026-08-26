import { render, screen } from "@testing-library/react";
import { Avatar, AvatarImage } from "../../components/ui/avatar";

jest.mock("@radix-ui/react-avatar", () => {
  const React = require("react") as typeof import("react");

  return {
    Root: React.forwardRef<
      HTMLSpanElement,
      React.HTMLAttributes<HTMLSpanElement>
    >((props, ref) => <span ref={ref} {...props} />),
    Image: React.forwardRef<
      HTMLImageElement,
      React.ImgHTMLAttributes<HTMLImageElement>
    >((props, ref) => <img ref={ref} {...props} />),
    Fallback: React.forwardRef<
      HTMLSpanElement,
      React.HTMLAttributes<HTMLSpanElement>
    >((props, ref) => <span ref={ref} {...props} />),
  };
});

describe("AvatarImage", () => {
  it("does not send the current page as the referrer for profile images", () => {
    render(
      <Avatar>
        <AvatarImage
          src="https://lh3.googleusercontent.com/a/example"
          alt="Google profile"
        />
      </Avatar>,
    );

    expect(screen.getByAltText("Google profile")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
  });

  it("allows an explicit referrer policy override", () => {
    render(
      <Avatar>
        <AvatarImage
          src="https://example.com/profile.png"
          alt="Custom profile"
          referrerPolicy="origin"
        />
      </Avatar>,
    );

    expect(screen.getByAltText("Custom profile")).toHaveAttribute(
      "referrerpolicy",
      "origin",
    );
  });
});
