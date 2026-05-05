import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function mockBootSequence(page: Page) {
  await page.route("**/api/boot/sequence", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        boot: [
          "Kernel awake",
          "Memory mapped",
          "Document vectors indexed",
          "Persona constraints loaded",
          "Terminal ready",
        ],
        haiku:
          "green phosphor wakes\nold filings become signal\nqueries find their mark",
      }),
    });
  });
}

async function mockChatStream(page: Page) {
  await page.route("**/api/chat/threads", async (route) => {
    const requestBody = route.request().postDataJSON();
    expect(requestBody).toEqual({ command: "/status" });

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
      body: `data: ${JSON.stringify({
        type: "complete",
        success: true,
        message:
          "Cogitatio Terminal is connected to Cogitatio Server - Systems Nominal.",
      })}\n\n`,
    });
  });
}

async function mockChatFailure(page: Page) {
  await page.route("**/api/chat/threads", async (route) => {
    const requestBody = route.request().postDataJSON();
    expect(requestBody).toEqual({ command: "hello" });

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Session error",
      }),
    });
  });
}

async function waitForTerminalReady(page: Page) {
  await expect(page.getByText(/Ready for queries/)).toBeVisible({
    timeout: 45_000,
  });
}

test("boots the terminal shell without backend failures", async ({ page }) => {
  await mockBootSequence(page);

  await page.goto("/");

  await expect(page).toHaveTitle("COGITATIO VIRTUALIS");
  await expect(page.getByText("SYSTEM ERROR")).toHaveCount(0);
  await waitForTerminalReady(page);
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(page.locator("input.crt-command-line__input")).toBeVisible();
});

test("submits a terminal command and renders the streamed response", async ({
  page,
}) => {
  await mockBootSequence(page);
  await mockChatStream(page);

  await page.goto("/");

  const commandInput = page.locator("input.crt-command-line__input");
  await waitForTerminalReady(page);
  await commandInput.focus();
  await page.keyboard.type("/status");
  await page.keyboard.press("Enter");

  await expect(
    page.getByText(
      "Cogitatio Terminal is connected to Cogitatio Server - Systems Nominal.",
    ),
  ).toBeVisible({ timeout: 10_000 });
});

test("preserves typed command text while editing", async ({ page }) => {
  await mockBootSequence(page);
  await page.goto("/");
  await waitForTerminalReady(page);

  const commandInput = page.locator("input.crt-command-line__input");

  await commandInput.focus();
  await page.keyboard.type("Hi Cogitatio, how are you");

  await expect(commandInput).toHaveValue("Hi Cogitatio, how are you");
  await expect(page.locator(".crt-command-line__input-string")).toContainText(
    "Hi Cogitatio, how are you",
  );
});

test("keeps wrapped command input aligned and visible", async ({ page }) => {
  await mockBootSequence(page);
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto("/");
  await waitForTerminalReady(page);

  const commandInput = page.locator("input.crt-command-line__input");
  const longCommand = `/search query ${"legal technology innovation ".repeat(24)}`;

  await commandInput.focus();
  await page.keyboard.type(longCommand);

  const metrics = await page.evaluate(() => {
    const prompt = document.querySelector(".crt-command-line__prompt");
    const inputWrapper = document.querySelector(
      ".crt-command-line__input-wrapper",
    );
    const inputString = document.querySelector(
      ".crt-command-line__input-string",
    );
    const scrollContainer = Array.from(
      document.querySelectorAll<HTMLElement>(".content-area *"),
    ).find((element) => {
      const overflowY = window.getComputedStyle(element).overflowY;
      return overflowY === "auto" || overflowY === "scroll";
    });

    if (!prompt || !inputWrapper || !inputString || !scrollContainer) {
      throw new Error("Terminal command line was not rendered");
    }

    const promptBox = prompt.getBoundingClientRect();
    const inputWrapperBox = inputWrapper.getBoundingClientRect();
    const inputStringBox = inputString.getBoundingClientRect();
    const scrollBox = scrollContainer.getBoundingClientRect();

    return {
      promptTop: promptBox.top,
      inputTop: inputWrapperBox.top,
      inputHeight: inputStringBox.height,
      inputBottom: inputStringBox.bottom,
      scrollBottom: scrollBox.bottom,
      scrollTop: scrollContainer.scrollTop,
      scrollHeight: scrollContainer.scrollHeight,
      clientHeight: scrollContainer.clientHeight,
    };
  });

  expect(Math.abs(metrics.promptTop - metrics.inputTop)).toBeLessThanOrEqual(2);
  expect(metrics.inputHeight).toBeGreaterThan(24);
  expect(metrics.inputBottom).toBeLessThanOrEqual(metrics.scrollBottom + 1);
  expect(metrics.scrollTop).toBeGreaterThan(0);
  expect(metrics.scrollTop + metrics.clientHeight).toBeGreaterThanOrEqual(
    metrics.scrollHeight - 1,
  );
});

test("renders chat API failures without crashing the terminal", async ({
  page,
}) => {
  await mockBootSequence(page);
  await mockChatFailure(page);

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  const commandInput = page.locator("input.crt-command-line__input");
  await waitForTerminalReady(page);
  await commandInput.focus();
  await page.keyboard.type("hello");
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Error executing command: Session error"),
  ).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("SYSTEM ERROR")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
