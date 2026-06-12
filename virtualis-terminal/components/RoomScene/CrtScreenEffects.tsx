/**
 * Owns the complete CRT tube effect stack for the new monitor shell.
 *
 * Car-pass tinting flows in through the `--car-color` custom property set on
 * the stage, so the stack needs no props.
 */
export function CrtScreenEffects() {
  return (
    <>
      <div className="tk-glass-window-reflect" aria-hidden="true" />
      <div className="tk-glass-headlight-reflect" aria-hidden="true" />
      <div className="tk-screen-static-scanlines" aria-hidden="true" />
      <div className="tk-screen-moving-scanner" aria-hidden="true" />
      <div className="tk-screen-noise" aria-hidden="true" />
      <div className="tk-screen-vignette" aria-hidden="true" />
      <div className="tk-screen-glare" aria-hidden="true" />
      <div className="tk-screen-flicker" aria-hidden="true" />
      <div className="tk-screen-breathe" aria-hidden="true" />
      <div className="tk-screen-poweron" aria-hidden="true">
        <div className="tk-poweron-shutters" />
        <div className="tk-poweron-line" />
        <div className="tk-poweron-bloom" />
      </div>
    </>
  );
}
