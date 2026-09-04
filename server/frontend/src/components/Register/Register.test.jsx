import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Register from "./Register";


beforeEach(() => {
  sessionStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("registration sends all profile fields and stores the authenticated user", async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ userName: "newuser", status: "Authenticated" }),
  });
  const onRegistered = jest.fn();
  render(
    <MemoryRouter>
      <Register onRegistered={onRegistered} />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newuser" } });
  fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "New" } });
  fireEvent.change(screen.getByLabelText("Last Name"), { target: { value: "User" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
  fireEvent.change(screen.getByLabelText("Password", { selector: "#password" }), { target: { value: "new-password" } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Register" }));

  await waitFor(() => expect(onRegistered).toHaveBeenCalledWith("newuser"));
  expect(global.fetch).toHaveBeenCalledWith(
    "/djangoapp/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: "newuser",
        firstName: "New",
        lastName: "User",
        email: "new@example.com",
        password: "new-password",
      }),
    },
  );
  expect(sessionStorage.getItem("username")).toBe("newuser");
});

test("registration rejects mismatched passwords before making a request", () => {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Password", { selector: "#password" }), { target: { value: "first-password" } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "different-password" } });
  fireEvent.submit(screen.getByRole("button", { name: "Register" }).closest("form"));

  expect(screen.queryByRole("alert")?.textContent).toBe("Passwords do not match.");
  expect(global.fetch).not.toHaveBeenCalled();
});
