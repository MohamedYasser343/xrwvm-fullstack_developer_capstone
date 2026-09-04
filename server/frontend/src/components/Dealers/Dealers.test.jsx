import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Dealers from "./Dealers";


const allDealers = [
  {
    id: 1,
    full_name: "Lone Star Cars",
    city: "Austin",
    address: "100 Congress Ave",
    zip: "78701",
    state: "Texas",
  },
  {
    id: 2,
    full_name: "Prairie Auto",
    city: "Wichita",
    address: "200 Douglas Ave",
    zip: "67202",
    state: "Kansas",
  },
];

beforeEach(() => {
  sessionStorage.clear();
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => ({
      status: 200,
      dealers: url.endsWith("/Kansas") ? [allDealers[1]] : allDealers,
    }),
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("selecting a state replaces the table with dealers in that state", async () => {
  render(
    <MemoryRouter>
      <Dealers />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("link", { name: "Lone Star Cars" })).not.toBeNull();
  fireEvent.change(screen.getByLabelText("Filter by state"), {
    target: { value: "Kansas" },
  });

  expect(await screen.findByRole("link", { name: "Prairie Auto" })).not.toBeNull();
  await waitFor(() => expect(screen.queryByText("Lone Star Cars")).toBeNull());
});

test("show all restores the complete dealer list", async () => {
  render(
    <MemoryRouter>
      <Dealers />
    </MemoryRouter>,
  );

  await screen.findByRole("link", { name: "Lone Star Cars" });
  fireEvent.change(screen.getByLabelText("Filter by state"), {
    target: { value: "Kansas" },
  });
  await screen.findByRole("link", { name: "Prairie Auto" });
  await waitFor(() => expect(screen.queryByText("Lone Star Cars")).toBeNull());
  fireEvent.change(screen.getByLabelText("Filter by state"), {
    target: { value: "All" },
  });

  expect(await screen.findByRole("link", { name: "Lone Star Cars" })).not.toBeNull();
  expect(screen.queryByRole("link", { name: "Prairie Auto" })).not.toBeNull();
});

test("authenticated users can open the review form from the dealer table", async () => {
  sessionStorage.setItem("username", "reviewer");

  render(
    <MemoryRouter>
      <Dealers />
    </MemoryRouter>,
  );

  const reviewLinks = await screen.findAllByRole("link", { name: /review/i });
  expect(reviewLinks[0].getAttribute("href")).toBe("/postreview/1");
});
