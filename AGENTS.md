# UI consistency
- Reuse existing UI components before adding markup or local CSS for a control.
- Icon-only actions in card headers must use IconButton, including edit, save and close.
- Keep dimensions, icon size, radius, hover/active animation, focus ring and disabled state identical within each action group.
- Fix shared component styles instead of adding per-button overrides. Preserve legitimate semantic differences only.
- Check both light and dark themes and narrow layouts when changing shared controls.
- Never report visual verification unless it was actually performed; report build checks separately.