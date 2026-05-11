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

async function mockProgressStream(page: Page) {
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
    expect(requestBody).toEqual({ command: "please think slowly" });

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
      body:
        `data: ${JSON.stringify({
          type: "progress",
          message: ">>> reticulating splines",
        })}\n\n` +
        `data: ${JSON.stringify({
          type: "complete",
          success: true,
          message: "The machine has returned.",
        })}\n\n`,
    });
  });
}

async function waitForTerminalReady(page: Page) {
  await expect(page.getByText(/Ready for queries/)).toBeVisible({
    timeout: 45_000,
  });
}

async function waitForAnimationFrames(page: Page, count = 2) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
  }, count);
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
      "Cogitatio Terminal is connected to Cogitatio Server - Systems",
    ),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Nominal.")).toBeVisible({ timeout: 10_000 });
});

test("renders ambient progress events during a long response", async ({
  page,
}) => {
  await mockBootSequence(page);
  await mockProgressStream(page);

  await page.goto("/");

  const commandInput = page.locator("input.crt-command-line__input");
  await waitForTerminalReady(page);
  await commandInput.focus();
  await page.keyboard.type("please think slowly");
  await page.keyboard.press("Enter");

  await expect(page.getByText(">>> reticulating splines")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("The machine has returned.")).toBeVisible({
    timeout: 10_000,
  });
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
  await page.setViewportSize({ width: 900, height: 650 });
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
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

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

test("lets users hold scrollback while new terminal output arrives", async ({
  page,
}) => {
  await mockBootSequence(page);
  await mockEmptyThread(page);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto("/");
  await waitForTerminalReady(page);

  await page.evaluate(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

    if (!scrollContainer) {
      throw new Error("Terminal scroll container was not rendered");
    }

    for (let index = 0; index < 80; index += 1) {
      const line = document.createElement("div");
      line.textContent = `scrollback filler ${index}`;
      line.style.minHeight = "24px";
      scrollContainer.appendChild(line);
    }
  });

  await page.waitForFunction(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );
    return (
      scrollContainer &&
      scrollContainer.scrollHeight > scrollContainer.clientHeight &&
      scrollContainer.scrollTop > 0
    );
  });

  await page.evaluate(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

    if (!scrollContainer) {
      throw new Error("Terminal scroll container was not rendered");
    }

    scrollContainer.dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }));
    scrollContainer.scrollTop = 0;
    scrollContainer.dispatchEvent(new Event("scroll"));

    const line = document.createElement("div");
    line.textContent = "output while reader is reviewing scrollback";
    line.style.minHeight = "24px";
    scrollContainer.appendChild(line);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    scrollContainer.dispatchEvent(new Event("scroll"));
  });
  await waitForAnimationFrames(page);

  const heldScrollTop = await page.evaluate(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

    if (!scrollContainer) {
      throw new Error("Terminal scroll container was not rendered");
    }

    return scrollContainer.scrollTop;
  });

  expect(heldScrollTop).toBeLessThanOrEqual(2);

  const scrollBox = await page
    .locator(".crt-terminal__overflow-container")
    .boundingBox();
  expect(scrollBox).not.toBeNull();
  await page.mouse.move(
    scrollBox!.x + scrollBox!.width / 2,
    scrollBox!.y + scrollBox!.height / 2,
  );
  await page.mouse.wheel(0, 5000);
  await page.waitForFunction(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );
    return (
      scrollContainer &&
      scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight <=
        48
    );
  });

  const resumedDistanceFromBottom = await page.evaluate(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".crt-terminal__overflow-container",
    );

    if (!scrollContainer) {
      throw new Error("Terminal scroll container was not rendered");
    }

    const line = document.createElement("div");
    line.textContent = "output after reader returned to the prompt";
    line.style.minHeight = "24px";
    scrollContainer.appendChild(line);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    scrollContainer.dispatchEvent(new Event("scroll"));

    return new Promise<number>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          resolve(
            scrollContainer.scrollHeight -
              scrollContainer.scrollTop -
              scrollContainer.clientHeight,
          );
        });
      });
    });
  });

  expect(resumedDistanceFromBottom).toBeLessThanOrEqual(48);
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

test("shows the intentional mobile replacement surface", async ({ page }) => {
  await mockBootSequence(page);
  await mockEmptyThread(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");

  await expect(
    page.getByText("TERMINAL REQUIRES LARGER DISPLAY"),
  ).toBeVisible();
  await expect(page.getByText("TRY YOUR DEVICE IN LANDSCAPE")).toHaveCount(0);
  await expect(
    page.getByText(/Cogitatio Virtualis is a CRT-style terminal experience/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /View resume/ })).toBeVisible();
  await expect(page.locator("input.crt-command-line__input")).toBeHidden();
});

test("prompts tablet portrait users to rotate when landscape would work", async ({
  page,
}) => {
  await mockBootSequence(page);
  await mockEmptyThread(page);
  await page.setViewportSize({ width: 768, height: 1024 });

  await page.goto("/");

  await expect(page.getByText("TRY YOUR DEVICE IN LANDSCAPE")).toBeVisible();
  await expect(
    page.getByText(/technically compatible in landscape/),
  ).toBeVisible();
  await expect(page.locator("input.crt-command-line__input")).toBeHidden();
});

test("keeps small landscape denial actions visible on the right", async ({
  page,
}) => {
  await mockBootSequence(page);
  await mockEmptyThread(page);
  await page.setViewportSize({ width: 844, height: 390 });

  await page.goto("/");

  const heading = page.getByText("TERMINAL REQUIRES LARGER DISPLAY");
  const resumeLink = page.getByRole("link", { name: /View resume/ });
  const contactLink = page.getByRole("link", { name: /Contact/ });

  await expect(heading).toBeVisible();
  await expect(resumeLink).toBeVisible();
  await expect(contactLink).toBeVisible();
  await expect(page.getByText("TRY YOUR DEVICE IN LANDSCAPE")).toHaveCount(0);

  const layout = await page.evaluate(() => {
    const heading = document.evaluate(
      "//*[text()='TERMINAL REQUIRES LARGER DISPLAY']",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
    ).singleNodeValue as HTMLElement | null;
    const resume = Array.from(document.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("View resume"),
    );
    const contact = Array.from(document.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Contact"),
    );

    if (!heading || !resume || !contact) {
      throw new Error("Landscape denial controls were not rendered");
    }

    const headingBox = heading.getBoundingClientRect();
    const resumeBox = resume.getBoundingClientRect();
    const contactBox = contact.getBoundingClientRect();

    return {
      headingRight: headingBox.right,
      resumeLeft: resumeBox.left,
      resumeBottom: resumeBox.bottom,
      contactBottom: contactBox.bottom,
      viewportHeight: window.innerHeight,
    };
  });

  expect(layout.resumeLeft).toBeGreaterThan(layout.headingRight);
  expect(layout.resumeBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.contactBottom).toBeLessThanOrEqual(layout.viewportHeight);
});
