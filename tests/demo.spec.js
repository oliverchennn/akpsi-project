import { test, expect } from "@playwright/test";
const ids = ["coffee", "rice", "oats", "sugar"];
test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
});
for (const width of [390, 1512]) {
  test(`sidebar switches views and preserves requests at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("switch").check();
    await page.getByRole("button", { name: "Busy afternoon" }).click();
    await page.clock.runFor(15000);
    const requests = page.getByRole("link", { name: "Demo requests", exact: true });
    await requests.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo requests");
    await expect(requests).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".breadcrumb strong")).toHaveText("Demo requests");
    await expect(page.locator(".platform-section")).toBeHidden();
    await expect(page.locator("#activity")).toBeHidden();
    await expect(page.locator("#requests")).toBeInViewport();
    await expect(page.locator(".request-row")).toHaveCount(4);
    await requests.click();
    await expect(page.locator("#requests")).toBeInViewport();
    await page.getByRole("link", { name: "Activity", exact: true }).click();
    await expect(page.locator("#activity")).toBeVisible();
    await expect(page.locator("#requests")).toBeHidden();
    await page.goBack();
    await expect(requests).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".request-row")).toHaveCount(4);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Store activity");
    await page.getByRole("link", { name: "Overview 4", exact: true }).click();
    await expect(page.getByRole("slider")).toHaveCount(4);
    await expect(page.locator("#low-count")).toHaveText("04 low-stock bins");
    await page.goto("/#requests");
    await expect(requests).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#requests")).toBeInViewport();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo requests");
  });
}
test("loads four complete platforms without console errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(page.getByRole("slider")).toHaveCount(4);
  await expect(page.locator("#total-net")).toHaveText("31.00 kg");
  await expect(page.locator("#healthy-count")).toHaveText("04 of 4 bins");
  expect(errors).toEqual([]);
});
test("every dial works with keyboard and keeps the other bins independent", async ({
  page,
}) => {
  const starts = [7.7, 12.2, 4.4, 9];
  for (const [index, id] of ids.entries()) {
    const dial = page.locator(`#card-${id} [role=slider]`);
    await dial.focus();
    await page.keyboard.press("ArrowDown");
    await expect(dial).toHaveAttribute(
      "aria-valuenow",
      String(Math.round((starts[index] - 0.1) * 100) / 100),
    );
    await page.keyboard.press("PageUp");
    await expect(dial).toHaveAttribute(
      "aria-valuenow",
      String(Math.round((starts[index] + 0.9) * 100) / 100),
    );
    await page.keyboard.press("Home");
    await expect(dial).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator(`#card-${id} .dial-main`)).toHaveText("0.00");
    await page.keyboard.press("End");
    await expect(page.locator(`#card-${id} .fill-percent`)).toHaveText(
      "100% full",
    );
    if (index < 3)
      await expect(page.locator(`#gross-${ids[index + 1]}`)).toHaveValue(
        starts[index + 1].toFixed(2),
      );
  }
});
test("every dial responds to pointer dragging", async ({ page }) => {
  for (const id of ids) {
    const dial = page.locator(`#card-${id} [role=slider]`);
    const box = await dial.boundingBox();
    const before = await dial.getAttribute("aria-valuenow");
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.width * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.width * 0.1, {
      steps: 5,
    });
    await page.mouse.up();
    expect(await dial.getAttribute("aria-valuenow")).not.toBe(before);
  }
});
test("numeric bounds, tare floor, plus/minus and save configuration", async ({
  page,
}) => {
  const input = page.locator("#gross-coffee");
  await input.fill("-2");
  await input.press("Enter");
  await expect(input).toHaveValue("0.00");
  await input.fill("999");
  await input.press("Enter");
  await expect(input).toHaveValue("10.50");
  await input.fill("0.2");
  await input.press("Enter");
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("0.00");
  await input.fill("5");
  await input.press("Enter");
  await page.getByRole("button", { name: "Configure Coffee beans" }).click();
  await page.locator("[name=name]").fill("Demo lentils");
  await page.locator("[name=tare]").fill("1");
  await page.locator("[name=capacity]").fill("12");
  await page.locator("[name=threshold]").fill("4");
  await page.locator("[name=monthly]").fill("60");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#card-coffee h3")).toHaveText("Demo lentils");
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("4.00");
  await expect(page.locator("#card-coffee .stock-badge")).toHaveText(
    "Low stock",
  );
  await expect(page.locator("#card-coffee .monthly-display")).toHaveText(
    "60.00 kg",
  );
  await page
    .getByRole("button", { name: "Increase Demo lentils gross weight" })
    .click();
  await expect(page.locator("#card-coffee .stock-badge")).toHaveText(
    "In stock",
  );
});
test("live consumption, approval and delivery preserve stock and avoid duplicates", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Busy afternoon" }).click();
  await expect(page.getByRole("switch")).toBeChecked();
  await page.clock.runFor(5000);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("4.80");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(5000);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("4.80");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.runFor(10000);
  await expect(page.locator("#low-count")).toHaveText("04 low-stock bins");
  await expect(page.locator(".request-row")).toHaveCount(4);
  await page.getByRole("link", { name: "Demo requests", exact: true }).click();
  await page.getByRole("button", { name: "Approve Coffee beans request", exact: true }).click();
  await expect(page.locator(".request-state.approved")).toHaveCount(1);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("0.00");
  await page.getByRole("button", { name: "Simulate delivery for Coffee beans", exact: true }).click();
  await expect(page.locator(".request-state.fulfilled")).toHaveCount(1);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("10.00");
  await page.getByRole("link", { name: "Overview 4", exact: true }).click();
  const feed = await page.locator("#activity-list").innerText();
  await page.locator("#card-coffee .refill-button").click();
  expect(await page.locator("#activity-list").innerText()).toBe(feed);
  await page.getByRole("button", { name: "Refill all", exact: true }).click();
  await expect(page.locator("#low-count")).toHaveText("00 low-stock bins");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.locator(".request-row")).toHaveCount(0);
  await expect(page.getByRole("switch")).not.toBeChecked();
  await expect(page.locator("#total-net")).toHaveText("31.00 kg");
  await page.clock.runFor(20000);
  await expect(page.locator("#total-net")).toHaveText("31.00 kg");
});

test("run time can change during consumption without jumping the inventory", async ({ page }) => {
  await page.getByLabel("Run time", { exact: true }).selectOption("30");
  await page.getByRole("button", { name: "Busy afternoon" }).click();
  await page.clock.runFor(15000);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("3.60");
  await page.getByLabel("Run time", { exact: true }).selectOption("60");
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("3.60");
  await page.clock.runFor(15000);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("1.80");
  await page.getByRole("button", { name: "Refill all", exact: true }).click();
  await page.clock.runFor(60000);
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("10.00");
});
test("configuration validates threshold and updates live stock state on save", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Configure Coffee beans" }).click();
  await page.locator("[name=threshold]").fill("10");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#form-error")).toContainText("below capacity");
  await page.locator("[name=threshold]").fill("8");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#card-coffee .stock-badge")).toHaveText(
    "Low stock",
  );
  await expect(page.locator(".activity-row[data-type=alert]")).toHaveCount(1);
  await page.getByRole("button", { name: "Configure Coffee beans" }).click();
  await page.locator("[name=threshold]").fill("2");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#card-coffee .stock-badge")).toHaveText(
    "In stock",
  );
});
test("mobile layout has no horizontal clipping and controls work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("slider")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const id of ids) {
    await page.locator(`#card-${id} .refill-button`).click();
    await expect(page.locator(`#card-${id} .fill-percent`)).toHaveText(
      "100% full",
    );
  }
  await page.getByRole("button", { name: "Configure Cane sugar" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({ path: "/tmp/tarely-mobile.png", fullPage: true });
});
test("help and keyboard modal dismissal plus desktop layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 1100 });
  await page.getByRole("button", { name: "How this demo works" }).click();
  await expect(
    page.getByRole("heading", { name: "Meet your virtual stockroom" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/tarely-desktop.png", fullPage: true });
});

test("AA accessibility checks pass for stocked, low-stock, settings and mobile states", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const check = async () => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await check();
  await page.getByRole("switch").check();
  await page.getByRole("button", { name: "Busy afternoon" }).click();
  await page.clock.runFor(15000);
  await check();
  await page.getByRole("button", { name: "Configure Coffee beans" }).click();
  await check();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await check();
});
test("responsive widths and enlarged text remain usable", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1512]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 768, height: 900 });
  await page.addStyleTag({ content: "body{zoom:2}" });
  await expect(page.getByRole("slider").first()).toBeVisible();
  await page.getByRole("slider").first().focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#card-coffee .dial-main")).toHaveText("0.00");
});
