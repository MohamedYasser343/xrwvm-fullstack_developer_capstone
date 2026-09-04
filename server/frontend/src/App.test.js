import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";


test("the register route shows the complete sign-up form", () => {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Create account" })).not.toBeNull();
  expect(screen.getByLabelText("Username")).not.toBeNull();
  expect(screen.getByLabelText("First Name")).not.toBeNull();
  expect(screen.getByLabelText("Last Name")).not.toBeNull();
  expect(screen.getByLabelText("Email")).not.toBeNull();
  expect(screen.getByLabelText("Password", { selector: "#password" })).not.toBeNull();
  expect(screen.getByLabelText("Confirm Password")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Register" })).not.toBeNull();
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
