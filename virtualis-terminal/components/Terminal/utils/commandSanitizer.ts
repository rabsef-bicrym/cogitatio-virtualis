/**
 * Removes leaked crt-terminal loader frames from a submitted command.
 */
export function stripLeakedLoaderFrame(
  command: string,
  loaderFrames: readonly string[],
): string {
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return trimmedCommand;
  }

  const frames = [...new Set(loaderFrames.filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  const leadingFrame = frames.find(
    (frame) => trimmedCommand.startsWith(frame) && trimmedCommand !== frame,
  );
  const withoutLeadingFrame = leadingFrame
    ? trimmedCommand.slice(leadingFrame.length).trimStart()
    : trimmedCommand;

  const trailingFrame = frames.find(
    (frame) =>
      withoutLeadingFrame.endsWith(frame) && withoutLeadingFrame !== frame,
  );
  const withoutTrailingFrame = trailingFrame
    ? withoutLeadingFrame.slice(0, -trailingFrame.length).trimEnd()
    : withoutLeadingFrame;

  return withoutTrailingFrame || trimmedCommand;
}

export function stripTrailingLoaderFrame(
  command: string,
  loaderFrames: readonly string[],
): string {
  return stripLeakedLoaderFrame(command, loaderFrames);
}
