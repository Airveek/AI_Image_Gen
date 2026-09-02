import { expect, test } from "@playwright/test";

test("business outcome showcase responds to click and keyboard navigation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Make the business visual you need, without learning prompt engineering.",
    }),
  ).toBeVisible();

  const marketTab = page.getByRole("tab", { name: "Market your business" });
  await marketTab.click();
  await expect(marketTab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Build the week’s marketing in one sitting." }),
  ).toBeVisible();

  await marketTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Build your brand" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Look established from the very first day." }),
  ).toBeVisible();
});

test("homepage stays within a 375px viewport and preserves checkout plan links", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);

  await expect(page.getByRole("link", { name: "Get instant access" }).first()).toHaveAttribute(
    "href",
    "/checkout?plan=commercial",
  );
  await expect(page.getByRole("link", { name: "Get instant access" }).last()).toHaveAttribute(
    "href",
    "/checkout?plan=premium",
  );
  await expect(page.getByText("per month", { exact: true })).toHaveCount(2);
  await expect(page.getByText(/one[- ]time|no monthly fee|lifetime access/i)).toHaveCount(0);
});
