import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Header from "./Header";


afterEach(() => {
  sessionStorage.clear();
});

test("anonymous visitors are offered login and registration links", () => {
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );

  expect(screen.queryByRole("link", { name: "Login" })?.getAttribute("href")).toBe("/login");
  expect(screen.queryByRole("link", { name: "Register" })?.getAttribute("href")).toBe("/register");
});

test("authenticated visitors see their username and a logout link", () => {
  sessionStorage.setItem("username", "existinguser");

  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );

  expect(screen.queryByText("existinguser")).not.toBeNull();
  expect(screen.queryByRole("link", { name: "Logout" })).not.toBeNull();
  expect(screen.queryByRole("link", { name: "Login" })).toBeNull();
});
