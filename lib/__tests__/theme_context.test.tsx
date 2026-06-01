// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { ThemeProvider, useTheme } from "../theme-context";

function ThemeReader() {
  const { theme } = useTheme();
  return <div data-testid="theme">{theme}</div>;
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeProvider", () => {
  it("defaults to mono theme", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    );
    expect(getByTestId("theme").textContent).toBe("mono");
  });

  it("applies data-theme attribute to html element", () => {
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("mono");
  });

  it("setTheme updates html data-theme attribute", () => {
    function Switcher() {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme("mono")}>switch</button>;
    }
    const { getByRole } = render(
      <ThemeProvider>
        <Switcher />
      </ThemeProvider>
    );
    act(() => { getByRole("button").click(); });
    expect(document.documentElement.getAttribute("data-theme")).toBe("mono");
  });

  it("initialTheme prop overrides default", () => {
    const { getByTestId } = render(
      <ThemeProvider initialTheme="mono">
        <ThemeReader />
      </ThemeProvider>
    );
    expect(getByTestId("theme").textContent).toBe("mono");
  });
});
