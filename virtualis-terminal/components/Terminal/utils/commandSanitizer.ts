/**
 * Removes a leaked crt-terminal loader frame from the end of a submitted command.
 */
export function stripTrailingLoaderFrame(
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
  const leakedFrame = frames.find(
    (frame) => trimmedCommand.endsWith(frame) && trimmedCommand !== frame,
  );

  if (!leakedFrame) {
    return trimmedCommand;
  }

  const commandWithoutFrame = trimmedCommand
    .slice(0, -leakedFrame.length)
    .trimEnd();

  return commandWithoutFrame || trimmedCommand;
}
