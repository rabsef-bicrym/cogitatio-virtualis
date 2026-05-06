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

async function mockEmptyThread(page: Page) {
  await page.route("**/api/chat/threads", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "OK",
          data: [],
        }),
      });
      return;
    }

    await route.fallback();
  });
}

async function mockChatStream(page: Page) {
  await page.route("**/api/chat/threads", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "OK",
          data: [],
        }),
      });
      return;
    }

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
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "OK",
          data: [],
        }),
      });
      return;
    }

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
  await mockEmptyThread(page);

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
  await mockEmptyThread(page);
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
  await mockEmptyThread(page);
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
    };
  });

  expect(Math.abs(metrics.promptTop - metrics.inputTop)).toBeLessThanOrEqual(2);
  expect(metrics.inputHeight).toBeGreaterThan(24);
  expect(metrics.inputBottom).toBeLessThanOrEqual(metrics.scrollBottom + 1);
  expect(metrics.scrollTop).toBeGreaterThan(0);
});

test("restores an existing session without replaying boot", async ({
  page,
}) => {
  let bootRequests = 0;
  const restoredThread = [
    {
      role: "user",
      timestamp: "2026-05-05T00:00:00.000Z",
      content: [{ type: "text", text: "Hi Cogitatio" }],
    },
    {
      role: "assistant",
      timestamp: "2026-05-05T00:00:01.000Z",
      content: [
        {
          type: "text",
          text: "<reply>Hello Eric. Session continuity is online.</reply>",
        },
      ],
    },
    ...Array.from({ length: 18 }, (_, index) => [
      {
        role: "user",
        timestamp: `2026-05-05T00:01:${String(index).padStart(2, "0")}.000Z`,
        content: [{ type: "text", text: `Prior question ${index + 1}` }],
      },
      {
        role: "assistant",
        timestamp: `2026-05-05T00:02:${String(index).padStart(2, "0")}.000Z`,
        content: [
          {
            type: "text",
            text: `<reply>Prior answer ${index + 1} with enough text to occupy the restored scrollback.</reply>`,
          },
        ],
      },
    ]).flat(),
  ];

  await page.route("**/api/boot/sequence", async (route) => {
    bootRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ boot: ["unexpected boot"], haiku: "unexpected" }),
    });
  });
  await page.route("**/api/chat/threads", async (route) => {
    if (route.request().method() === "POST") {
      const requestBody = route.request().postDataJSON();
      expect(requestBody).toEqual({ command: "continue restored session" });

      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
        body: `data: ${JSON.stringify({
          type: "complete",
          success: true,
          message: "Restored chat is ready for the next turn.",
        })}\n\n`,
      });
      return;
    }

    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "OK",
        data: restoredThread,
      }),
    });
  });

  await page.goto("/");
  await expect(page.locator("input.crt-command-line__input")).toBeVisible({
    timeout: 10_000,
  });

  await expect(page.getByText("Hi Cogitatio")).toBeVisible();
  await expect(
    page.getByText("Hello Eric. Session continuity is online."),
  ).toBeVisible();
  await expect(page.locator(".crt-restored-transcript")).toBeVisible();
  await expect(
    page.locator(".crt-restored-line.line-spacer").first(),
  ).toHaveText(" ");
  await expect(
    page.getByText("Prior answer 18 with enough text"),
  ).toBeVisible();

  const restoreMetrics = await page.evaluate(() => {
    const commandLine = document.querySelector(".crt-terminal__command-line");
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

    if (!commandLine || !scrollContainer) {
      throw new Error("Restored terminal DOM was not rendered");
    }

    const commandLineBox = commandLine.getBoundingClientRect();
    const scrollBox = scrollContainer.getBoundingClientRect();

    return {
      commandLineBottom: commandLineBox.bottom,
      scrollBottom: scrollBox.bottom,
      scrollTop: scrollContainer.scrollTop,
    };
  });

  expect(restoreMetrics.commandLineBottom).toBeLessThanOrEqual(
    restoreMetrics.scrollBottom + 1,
  );
  expect(restoreMetrics.scrollTop).toBeGreaterThan(0);

  await page.keyboard.type("continue restored session");
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Restored chat is ready for the next turn."),
  ).toBeVisible();
  await expect(page.locator("input.crt-command-line__input")).toBeEnabled();
  await expect(page.locator("input.crt-command-line__input")).toHaveValue("");
  expect(bootRequests).toBe(0);
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
