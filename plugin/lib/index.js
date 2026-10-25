/**
 * dsh-boot-intro — host half.
 *
 * This bundle exists for its *browser* half: the tokamak ignition intro that
 * paints over the DSH shell on launch. The host row is intentionally inert —
 * the animation needs no backend, no routes and no services — but the row must
 * resolve to a valid Cordis plugin, otherwise the loader reports a row failure
 * when the bundle is mounted.
 */

export const name = 'dsh-boot-intro';
export const inject = [];

export function apply() {
  // No host-side behaviour: everything happens in lib/client.js.
}

export default { name, inject, apply };