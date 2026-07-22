import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Geografie
// ---------------------------------------------------------------------------

export const municipalities = sqliteTable("municipalities", {
  code: text("code").primaryKey(), // CBS gemeentecode, bv. GM0772
  naam: text("naam").notNull(),
  slug: text("slug").notNull().unique(),
});

export const neighborhoods = sqliteTable(
  "neighborhoods",
  {
    buurtCode: text("buurt_code").primaryKey(), // CBS buurtcode, bv. BU07720110
    naam: text("naam").notNull(),
    slug: text("slug").notNull(),
    gemeenteCode: text("gemeente_code")
      .notNull()
      .references(() => municipalities.code),
    // CBS Kerncijfers wijken en buurten
    gemWoz: integer("gem_woz"), // gemiddelde WOZ-waarde in euro
    inwoners: integer("inwoners"),
    // Afgeleiden uit eigen data (gelabeld als afgeleide in de UI)
    gemOppervlakte: real("gem_oppervlakte"), // m2, uit eigen adresrijen
    ankerM2Prijs: real("anker_m2_prijs"), // gem_woz / gem_oppervlakte
  },
  (t) => [index("idx_neighborhoods_gemeente").on(t.gemeenteCode), uniqueIndex("uq_neighborhoods_slug").on(t.gemeenteCode, t.slug)],
);

// ---------------------------------------------------------------------------
// Adressen en waarde
// ---------------------------------------------------------------------------

export type Woningtype = "appartement" | "tussenwoning" | "hoekwoning" | "twee-onder-een-kap" | "vrijstaand";
export type EnergielabelBron = "echt" | "indicatie";
export type AdresStatus = "actief" | "opted_out";
export type DataBron = "bag" | "seed";

export const addresses = sqliteTable(
  "addresses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bagId: text("bag_id"), // BAG verblijfsobject-id, null bij seed
    straat: text("straat").notNull(),
    huisnummer: integer("huisnummer").notNull(),
    toevoeging: text("toevoeging"), // "a", "2", null
    nummerslug: text("nummerslug").notNull(), // "12", "12a", "12-2" (URL-sleutel)
    postcode: text("postcode").notNull(), // "5611AB" zonder spatie
    plaats: text("plaats").notNull(),
    buurtCode: text("buurt_code")
      .notNull()
      .references(() => neighborhoods.buurtCode),
    lat: real("lat"),
    lon: real("lon"),
    bouwjaar: integer("bouwjaar").notNull(),
    oppervlakteM2: integer("oppervlakte_m2").notNull(),
    woningtype: text("woningtype").$type<Woningtype>().notNull(),
    energielabel: text("energielabel"), // A t/m G
    energielabelBron: text("energielabel_bron").$type<EnergielabelBron>().notNull().default("indicatie"),
    bron: text("bron").$type<DataBron>().notNull().default("seed"),
    status: text("status").$type<AdresStatus>().notNull().default("actief"),
  },
  (t) => [
    uniqueIndex("uq_addresses_postcode_nummerslug").on(t.postcode, t.nummerslug),
    index("idx_addresses_buurt").on(t.buurtCode),
    index("idx_addresses_straat").on(t.straat),
    index("idx_addresses_postcode").on(t.postcode),
  ],
);

// Verkopen. HARDE REGEL: bron=seed heeft NOOIT een adres_id; synthetische
// koopsommen hangen alleen aan buurt/straat, nooit aan een echt adres.
export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    buurtCode: text("buurt_code")
      .notNull()
      .references(() => neighborhoods.buurtCode),
    straat: text("straat"), // alleen straatnaam, geen huisnummer bij seed
    adresId: integer("adres_id").references(() => addresses.id), // alleen bij bron=kadaster
    datum: text("datum").notNull(), // ISO yyyy-mm-dd
    prijs: integer("prijs").notNull(), // euro
    oppervlakteM2: integer("oppervlakte_m2").notNull(),
    woningtype: text("woningtype").$type<Woningtype>().notNull(),
    bron: text("bron").$type<"seed" | "kadaster">().notNull().default("seed"),
  },
  (t) => [index("idx_sales_buurt_datum").on(t.buurtCode, t.datum), index("idx_sales_straat").on(t.straat)],
);

export type Confidence = "hoog" | "middel" | "laag";

export const valuations = sqliteTable(
  "valuations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adresId: integer("adres_id")
      .notNull()
      .references(() => addresses.id),
    datum: text("datum").notNull(), // ISO yyyy-mm-dd
    waarde: integer("waarde").notNull(),
    intervalLaag: integer("interval_laag").notNull(),
    intervalHoog: integer("interval_hoog").notNull(),
    confidence: text("confidence").$type<Confidence>().notNull(),
    nComparables: integer("n_comparables").notNull(),
    modelVersie: text("model_versie").notNull(),
    inputsJson: text("inputs_json").notNull(), // JSON van modelinputs, voor uitlegbaarheid
  },
  (t) => [index("idx_valuations_adres_datum").on(t.adresId, t.datum)],
);

export const wozValues = sqliteTable(
  "woz_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adresId: integer("adres_id")
      .notNull()
      .references(() => addresses.id),
    peiljaar: integer("peiljaar").notNull(),
    waarde: integer("waarde").notNull(),
    bron: text("bron").$type<"eigenaar" | "seed">().notNull(),
  },
  (t) => [index("idx_woz_adres").on(t.adresId)],
);

// ---------------------------------------------------------------------------
// Gebruikers, claims, consent
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  verifiedAt: text("verified_at"), // ISO datetime
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random token
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);

export const magicTokens = sqliteTable(
  "magic_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(), // sha256 hex
    expiresAt: text("expires_at").notNull(), // 15 min na aanmaak
    usedAt: text("used_at"), // eenmalig gebruik
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_magic_tokens_email").on(t.email)],
);

// Claims zijn zelfverklaringen: e-mail bewezen, relatie met het adres niet.
// Meerdere claims per adres zijn toegestaan; verificatie is een livegang-TODO.
export const claims = sqliteTable(
  "claims",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    adresId: integer("adres_id")
      .notNull()
      .references(() => addresses.id),
    rol: text("rol").$type<"eigenaar" | "bewoner">().notNull(),
    createdAt: text("created_at").notNull(),
    endedAt: text("ended_at"), // gezet bij opt-out van het adres of opzegging
  },
  (t) => [index("idx_claims_user").on(t.userId), index("idx_claims_adres").on(t.adresId)],
);

// Hypotheekgegevens per claim; voedt de triggers overwaarde en oversluiten.
export const mortgageInfo = sqliteTable("mortgage_info", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claimId: integer("claim_id")
    .notNull()
    .references(() => claims.id)
    .unique(),
  restantEur: integer("restant_eur").notNull(),
  rentePct: real("rente_pct"),
  rentevastTot: text("rentevast_tot"), // ISO yyyy-mm-dd
  updatedAt: text("updated_at").notNull(),
});

// AVG art. 7: toestemming moet aantoonbaar zijn. Elke opt-in wordt hier gelogd
// met doel en letterlijke tekstversie.
export type ConsentDoel = "alerts" | "marketing" | "widget" | "lead_doorgifte";

export const consents = sqliteTable(
  "consents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    email: text("email").notNull(),
    doel: text("doel").$type<ConsentDoel>().notNull(),
    tekstversie: text("tekstversie").notNull(), // letterlijke checkbox-tekst + versienummer
    bron: text("bron").notNull(), // bv. "claim-flow", "widget:example.com", "funnel:hypotheek"
    consentedAt: text("consented_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("idx_consents_email").on(t.email)],
);

export const alertSubscriptions = sqliteTable(
  "alert_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    claimId: integer("claim_id")
      .notNull()
      .references(() => claims.id)
      .unique(),
    frequentie: text("frequentie").$type<"maandelijks">().notNull().default("maandelijks"),
    actief: integer("actief", { mode: "boolean" }).notNull().default(true),
    laatstVerzonden: text("laatst_verzonden"),
  },
  (t) => [index("idx_alerts_claim").on(t.claimId)],
);

// ---------------------------------------------------------------------------
// E-mail (outbox-patroon: lokaal wordt niets echt verstuurd)
// ---------------------------------------------------------------------------

export type EmailType =
  | "magic_link"
  | "alert"
  | "optout_bevestiging"
  | "optout_afgerond"
  | "lead_bevestiging"
  | "widget_double_optin"
  | "claim_beeindigd";

export const emailsOutbox = sqliteTable(
  "emails_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    type: text("type").$type<EmailType>().notNull(),
    status: text("status").$type<"queued" | "sent_mock">().notNull().default("queued"),
    createdAt: text("created_at").notNull(), // retentie: 90 dagen (scripts/purge.ts)
  },
  (t) => [index("idx_outbox_created").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Leads en premium
// ---------------------------------------------------------------------------

export type LeadType = "hypotheek" | "makelaar" | "taxatie" | "verduurzaming";
export type LeadStatus = "nieuw" | "gekwalificeerd" | "doorgestuurd" | "gesloten" | "afgewezen";

export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").$type<LeadType>().notNull(),
    subtype: text("subtype"), // bv. zonnepanelen | warmtepomp | isolatie | overwaarde | oversluiten | aankoop
    adresId: integer("adres_id").references(() => addresses.id),
    userId: integer("user_id").references(() => users.id),
    email: text("email").notNull(),
    antwoordenJson: text("antwoorden_json").notNull(),
    status: text("status").$type<LeadStatus>().notNull().default("nieuw"),
    estValueEur: integer("est_value_eur").notNull(),
    consentId: integer("consent_id").references(() => consents.id),
    createdAt: text("created_at").notNull(),
    retentieTot: text("retentie_tot").notNull(), // handhaving via scripts/purge.ts
  },
  (t) => [index("idx_leads_type_status").on(t.type, t.status), index("idx_leads_created").on(t.createdAt)],
);

export const leadEvents = sqliteTable(
  "lead_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id),
    event: text("event").notNull(),
    ts: text("ts").notNull(),
  },
  (t) => [index("idx_lead_events_lead").on(t.leadId)],
);

export const premiumEntitlements = sqliteTable(
  "premium_entitlements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    product: text("product").$type<"biedadvies" | "marktanalyse">().notNull(),
    status: text("status").$type<"actief" | "verlopen">().notNull().default("actief"),
    mockPaymentRef: text("mock_payment_ref").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_premium_user").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Opt-out (centrale suppressielijst), widget, rapporten
// ---------------------------------------------------------------------------

// De suppressielijst is LEIDEND boven elke databron en overleeft her-ingest.
// lib/suppression.ts is de enige toegangslaag; render- en API-paden checken daar.
export const optouts = sqliteTable(
  "optouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adresId: integer("adres_id")
      .notNull()
      .references(() => addresses.id),
    postcode: text("postcode").notNull(),
    nummerslug: text("nummerslug").notNull(),
    email: text("email"),
    reden: text("reden"),
    token: text("token").notNull().unique(), // bevestigingstoken (stap 2 van de flow)
    aangevraagdAt: text("aangevraagd_at").notNull(),
    bevestigdAt: text("bevestigd_at"), // pas na bevestiging is de opt-out actief
  },
  (t) => [uniqueIndex("uq_optouts_adres_key").on(t.postcode, t.nummerslug), index("idx_optouts_adres").on(t.adresId)],
);

export const widgetCaptures = sqliteTable(
  "widget_captures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    adresId: integer("adres_id").references(() => addresses.id),
    bronDomein: text("bron_domein").notNull(),
    consentId: integer("consent_id").references(() => consents.id),
    bevestigToken: text("bevestig_token").notNull().unique(),
    bevestigdAt: text("bevestigd_at"), // double opt-in; onbevestigd na 30 dagen gepurged
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_widget_captures_created").on(t.createdAt)],
);

// Deel-je-rapport: publiek token, alleen data die ook op de publieke
// adrespagina staat. Intrekbaar; opt-out van het adres revoceert altijd.
export const sharedReports = sqliteTable(
  "shared_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique(),
    claimId: integer("claim_id")
      .notNull()
      .references(() => claims.id),
    adresId: integer("adres_id")
      .notNull()
      .references(() => addresses.id),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("idx_shared_reports_adres").on(t.adresId)],
);

// ---------------------------------------------------------------------------
// SEO-gating en marktsignalen
// ---------------------------------------------------------------------------

export const indexGating = sqliteTable(
  "index_gating",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope").$type<"buurt" | "postcode4">().notNull(),
    code: text("code").notNull(), // buurt_code of postcode4
    indexeerbaar: integer("indexeerbaar", { mode: "boolean" }).notNull().default(false),
    reden: text("reden"),
  },
  (t) => [uniqueIndex("uq_gating_scope_code").on(t.scope, t.code)],
);

export const marketStats = sqliteTable(
  "market_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    buurtCode: text("buurt_code")
      .notNull()
      .references(() => neighborhoods.buurtCode),
    maand: text("maand").notNull(), // "2026-07"
    mediaanPrijs: integer("mediaan_prijs"),
    doorlooptijdDagen: integer("doorlooptijd_dagen"),
    overbiedingPct: real("overbieding_pct"), // positief = overbieden
    volume: integer("volume"),
    bron: text("bron").$type<"seed">().notNull().default("seed"),
  },
  (t) => [uniqueIndex("uq_market_stats").on(t.buurtCode, t.maand)],
);
