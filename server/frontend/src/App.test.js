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
