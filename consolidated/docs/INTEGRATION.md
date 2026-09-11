# Adapter contracts and operating boundaries

## Canonical interfaces
```ts
type ObjectId = string; // SHA-256; does not encode ownership or rights
type Locator =
 | {kind:'pdf'; page:number; rect?:[number,number,number,number]; quote?:string}
 | {kind:'zim'; entryPath:string; quote?:string}
 | {kind:'epub'; cfi:string; quote?:string}
 | {kind:'text'; start:number; end:number; quote:string}
 | {kind:'media'; startSeconds:number; endSeconds?:number};
interface OpenWork {
 version:1; appId:string; workId:string; editionId:string;
 objectId:ObjectId; locator?:Locator;
}
interface ReaderAdapter {
 open(objectId:ObjectId):Promise<{title:string; capabilities:string[]}>;
 navigate(locator:Locator):Promise<void>;
 search(query:string):Promise<{locator:Locator;snippet:string}[]>;
 close():Promise<void>;
}
interface ModelAdapter {
 load(objectId:ObjectId):Promise<void>;
 generate(request:unknown,signal:AbortSignal):AsyncIterable<string>;
 unload():Promise<void>;
}
```
Production calls are authenticated and bound to an application/profile grant. These are contracts; the prototype does not implement every interface.

## Reference HTTP API
GET /api/config: public preview capabilities and checkout readiness; no credentials.
GET /api/assets: local single-profile catalogue.
POST /api/assets?kind=pdf|final|audio|video|zim|model&name=...: raw streamed bytes, X-MBA-Client: enzime required. 20 GiB hard limit in reference store. No arbitrary server path imports.
GET /api/assets/{sha256}/bytes: full bytes or single explicit byte range. Safe MIME derives from supported import kind, not request Content-Type.
GET/POST /api/state/{sha256}: one reading-state record; 64 KiB write limit. Mature annotation collections and schema validation are future work.
GET /checkout: 303 to configured RevenueCat hosted URL, otherwise 503. A redirect does not activate a license.

The local API enforces loopback Host and rejects cross-origin browser requests. It is not the production authenticated broker. Keep private content off public hosting. Production needs explicit sessions/capability grants, request validation, rate/size limits, and an operational boundary between static marketing and private storage.

## Storage evolution
Reference: objects/{sha256}, tmp/{uuid}, catalog.sqlite. A hash currently has one metadata row. Mature schema separates objects, works, editions, renditions, application grants, drafts, revisions, locators and annotations. Multiple catalogue entries referencing identical bytes must preserve separate names/rights/editions. Store notes per profile, not globally per object. A directory lock or service ownership must ensure one broker process per root; SQLite transactions alone do not authorize multiple apps.

## Billing handoff
RevenueCat collection -> verified provider adapter -> durable BIDLR inbox -> canonical order/grant state -> signed client snapshot. Configure actual product IDs and principal mapping centrally. Implement reconciliation independently of webhook delivery. Ed25519 verification in billing.mjs is an integration primitive; it is not connected to a paid feature gate, account service, or key-rotation mechanism yet.

Release paths must not copy BIDLR operator tokens into client code. Product purchase links are public configuration; provider API credentials are private. The public landing's anonymous checkout must have redemption enabled. Do not set production checkout until refund/restore and entitlement issuance pass.

## Sanctissimissa
The storefront selects a verified edition and passes OpenWork through a host bridge. The Reader asks the shared broker for authorized bytes, resolves an edition-aware location, and reports updated position under the appropriate profile/application scope. Notes are private unless explicitly shared. Keep liturgical navigation in Sanctissimissa. Only explicitly selected sources are sent to an AI provider. Catalogue importing and rights review are separate from rendering.

## DynDon: common plan for every ZIM download and generation
All entry points call a versioned DynDon service before download, creation, regeneration or export. Wikipedia supplies one source adapter; it does not own a separate budget policy.

The plan request identifies application/profile, source collection and immutable source revision(s), operation (download/generate/regenerate), storage root, final-byte budget, peak working-space limit, hierarchy/version, coverage mode, domain filters, depth/breadth controls and protected reading units. The broker grants a scoped reservation rather than trusting a UI-only free-space estimate.

Adapters report available taxonomy, entry and resource dependencies, transfer capabilities, and writer/reader compatibility. A plan returns selected complete reading units, coverage and omission summaries, dependency closure, final/peak byte estimates with uncertainty, reservation ID, and a source-bound plan ID. Sequential works keep their declared order; storage fitting does not authorize arbitrary text truncation or AI substitution.

Execution validates the plan's source revision and reservation. Downloaders fetch supported source ranges/objects; generators pass selected source units to the validated AnZimmerman writer adapter. Measure actual encoded size, enforce the reservation, verify the complete result, then atomically publish the new local object/manifest. On overrun, interruption or failure, preserve previous readable artifacts and surface replan/retry; incomplete output is not catalogued as ready. Generation can use an explicit user-approved deterministic fitting policy, but cannot silently discard protected content.

Required integration fixtures: Wikipedia download, another publisher's ZIM download, newly generated user collection, edited-collection regeneration, absent hierarchy/manifest, compressed-size underestimate and a complete sequential work. These contracts implement PRD DD-01..10 when connected; the reference HTTP API above currently has no DynDon planner or writer endpoint.
