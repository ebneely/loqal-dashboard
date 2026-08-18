import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home page", () => {
  it("renders the Loqal Dashboard heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /loqal dashboard/i })
    ).toBeInTheDocument();
  });
});
