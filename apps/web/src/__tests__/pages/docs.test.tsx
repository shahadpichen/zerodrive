import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Docs from "../../pages/docs";

jest.mock("../../components/landing-page/header", () => () => (
  <header>ZeroDrive header</header>
));
jest.mock("../../components/landing-page/footer", () => () => (
  <footer>ZeroDrive footer</footer>
));

describe("documentation home", () => {
  it("presents task-oriented categories and a quick-start path", () => {
    render(
      <MemoryRouter>
        <Docs />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: /protect your files without guessing/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start the quick guide/i }),
    ).toHaveAttribute("href", "/docs/how-to-use");
    expect(
      screen.getByRole("heading", { name: "Getting started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Troubleshooting" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Self-hosting" }),
    ).toBeInTheDocument();
  });

  it("finds a focused guide without sending the query anywhere", () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    render(
      <MemoryRouter>
        <Docs />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /search documentation/i }), {
      target: { value: "HEIC preview" },
    });

    expect(
      screen
        .getAllByRole("link", { name: /preview and download files/i })
        .some(
          (link) =>
            link.getAttribute("href") === "/docs/previews-and-downloads",
        ),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
