import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";


test("the register route shows the complete sign-up form", () => {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.queryByRole("heading", { name: "Create account" })).not.toBeNull();
  expect(screen.queryByLabelText("Username")).not.toBeNull();
  expect(screen.queryByLabelText("First Name")).not.toBeNull();
  expect(screen.queryByLabelText("Last Name")).not.toBeNull();
  expect(screen.queryByLabelText("Email")).not.toBeNull();
  expect(screen.queryByLabelText("Password", { selector: "#password" })).not.toBeNull();
  expect(screen.queryByLabelText("Confirm Password")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Register" })).not.toBeNull();
});

test("the dealerships route shows the dealer directory", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 200, dealers: [] }),
  });

  render(
    <MemoryRouter initialEntries={["/dealers"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Find a dealership" })).not.toBeNull();
  expect(await screen.findByText("No dealerships were found for this state.")).not.toBeNull();
});
