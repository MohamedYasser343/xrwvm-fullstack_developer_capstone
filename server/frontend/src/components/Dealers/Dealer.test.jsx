import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Dealer from "./Dealer";


beforeEach(() => {
  sessionStorage.clear();
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith("djangoapp/dealer/3")) {
      return {
        ok: true,
        json: async () => ({
          status: 200,
          dealer: [{
            id: 3,
            full_name: "Best Cars Birmingham",
            city: "Birmingham",
            address: "300 First Ave",
            zip: "35203",
            state: "Alabama",
          }],
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        status: 200,
        reviews: [{
          id: 8,
          name: "Grace Hopper",
          dealership: 3,
          review: "A wonderfully helpful team.",
          purchase: true,
          purchase_date: "2023-01-02",
          car_make: "Toyota",
          car_model: "Camry",
          car_year: 2022,
          sentiment: "positive",
        }, {
          id: 9,
          name: "Older Reviewer",
          dealership: 3,
          review: "An older review returned second by the service.",
          purchase: false,
          purchase_date: "2022-01-02",
          car_make: "Ford",
          car_model: "Focus",
          car_year: 2020,
          sentiment: "neutral",
        }],
      }),
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("dealer reviews are presented as Bootstrap cards", async () => {
  render(
    <MemoryRouter initialEntries={["/dealer/3"]}>
      <Routes>
        <Route path="/dealer/:id" element={<Dealer />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Best Cars Birmingham" })).not.toBeNull();
  const review = await screen.findByText(/A wonderfully helpful team\./);
  expect(review.closest(".card")).not.toBeNull();
  expect(screen.queryByText(/Grace Hopper/)).not.toBeNull();
  expect(screen.queryByRole("img", { name: "Positive sentiment" })).not.toBeNull();
});

test("dealer reviews retain the newest-first order returned by the service", async () => {
  render(
    <MemoryRouter initialEntries={["/dealer/3"]}>
      <Routes>
        <Route path="/dealer/:id" element={<Dealer />} />
      </Routes>
    </MemoryRouter>,
  );

  const cards = await screen.findAllByRole("article");
  expect(cards[0].textContent).toContain("A wonderfully helpful team.");
  expect(cards[1].textContent).toContain("An older review returned second by the service.");
});
