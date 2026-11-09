# Page header audit

- PageHeading is shared by collection, showcase, news, discussions, market, notifications, achievements, statistics, account, settings, profile and administrative pages.
- SearchToolbar is shared by games, news, discussions and market. Its search, filters and result counter are not separate page implementations.
- Chats previously duplicated heading markup; migrated to PageHeading.
- Primary header actions used btn-primary and market-compose-btn--toolbar with different font sizes. Both now share page-controls typography tokens. Secondary actions use the same tokens.
- Notifications, analytics and administrative data toolbars retain specialized data controls but share action typography.
- Game catalogue intentionally keeps its accessible hidden heading and visible search toolbar.
- Remaining legacy overlap: btn-primary and market-compose-btn are two visual button classes. Header typography is centralized; they are not yet a single React button component. HeaderIconButton and IconButton likewise have distinct shapes and scopes.

Validation: TypeScript and production build passed. This is a source audit, not a browser screenshot audit; light/dark/mobile visual verification remains outstanding.