/**
 * Sales-console copy (English). Split out of the former monolithic en.ts —
 * see en.ts for the composition. Content is unchanged from the original
 * design-system transcription; only the file boundary moved.
 *
 * A concurrent agent is building out the sales console's admin-operations
 * screens and will append further keys here directly — this file is never
 * touched by en.ts/ar.ts again once the split lands.
 */
export const salesEn = {
  consoleLabel: "Sales",
  preferences: "Preferences",
  language: "Language",
  dark: "Dark appearance",
  darkHint: "Same tokens under a .dark scope.",
  dataState: "Category coverage",
  dataStateHint: "Development control. Switches the category to one with fewer than three brands, which is what triggers the withheld comparison.",
  bandState: "Commission band",
  noCustomerData: "No customer data on this device",
  noCustomerDataBody: "This console carries no shopper names, no orders and no other brand's dashboard. A phone left in a shop loses nothing.",
  packTitle: "What Loqal already sells in",
  packSub: "Real demand in this shop's category, from the last 30 days.",
  searches: "Searches",
  shoppers: "Shoppers",
  zeroResults: "Found nothing",
  zeroNote: "asked for, not stocked",
  deliveredOrders: "Delivered orders",
  last30: "last 30 days",
  comparisonTitle: "How shops like this one do",
  comparisonWith: "Averaged across {n} brands in this category. No shop is named.",
  blockedTitle: "Withheld on purpose",
  blockedBodyTpl: "Only {n} brands trade in this category. Below three, an average stops being a market fact and becomes one shop's private revenue. Loqal does not show it, to you or to them.",
  onboardTitle: "Register this shop",
  stepOf: "Step {a} of {b} · {name}",
  stepBusiness: "The shop",
  stepContact: "Who runs it",
  stepTrading: "How it sells",
  resumableTitle: "Saved as you go",
  resumableBody: "Leave mid-conversation and come back. Nothing is lost.",
  shopName: "Shop name",
  category: "Category",
  address: "Address",
  ownerName: "Owner's name",
  phone: "Phone",
  email: "Email",
  inviteHint: "The invite link goes to this address. Loqal never emails a password.",
  deliveryFee: "Delivery fee the shop charges",
  returnWindow: "Return window (days)",
  minOrder: "Minimum order value",
  routes: "How it delivers",
  routeRider: "The shopper books their own rider",
  routeOwn: "Own driver or courier account",
  termsTitle: "The offer",
  termsSub: "Pre-filled with the platform default. You may close anywhere inside the band.",
  bandTitle: "Your band",
  bandNote: "Set by Loqal. Anything outside it cannot be submitted, only discussed.",
  commissionFloor: "Commission floor",
  maxFree: "Maximum free period",
  unboundedTitle: "No band is set yet",
  unboundedBody: "Loqal has not fixed a floor while the first brands are being signed. Anything you agree here goes to an admin before it binds.",
  commission: "Commission",
  freeMonths: "Free period",
  belowFloor: "Below the floor. Not submittable.",
  insideBand: "Inside the band.",
  aboveMax: "Longer than the maximum. Not submittable.",
  offerTitle: "What the shop signs",
  thenWhat: "After the free period",
  thenWhatValue: "350.00 EGP monthly, plus the commission above.",
  nextStep: "Next",
  finishOnboard: "Save and continue to the offer",
  sendOffer: "Send the offer for signature",
  barHintPack: "Show this, then register the shop.",
  barHintTerms: "Nothing is sent until you press.",
  startOnboard: "Register this shop",
  months: "months",

  // -----------------------------------------------------------------------
  // The console shell. Three tabs and a sign-out; deliberately nothing else.
  // -----------------------------------------------------------------------
  navPack: "Pack",
  navOnboard: "Register",
  navTerms: "Terms",
  signOut: "Sign out",
  deniedTitle: "This console belongs to a sales account",
  deniedBody: "Nothing here is available to a shop's own account. A sales account carries no brand of its own and sees no orders and no shopper.",
  errorTitle: "That did not load",
  errorBody: "The connection dropped or the server refused. Nothing was changed.",
  retry: "Try again",

  // -----------------------------------------------------------------------
  // /pack
  // -----------------------------------------------------------------------
  packLead: "What Loqal can already show for this shop's category. Each figure below carries the period it covers.",
  chooseCategory: "Choose the shop's category",
  categoryEmptyTitle: "Pick a category first",
  categoryEmptyBody: "The pack is built per category, so nothing can be shown until one is chosen.",
  categoryNoneTitle: "No categories to choose from",
  categoryNoneBody: "Loqal's category list came back empty, so there is nothing to build a pack against.",
  proofTitle: "Loqal's own reach",
  eventsLabel: "Recorded activity",
  visitorsLabel: "Visitors",
  allTime: "all time, since launch",
  scopeWarnTitle: "These two count different periods",
  scopeWarnBody: "Activity is the last 30 days. Visitors is every visitor Loqal has ever had. They are not a matched pair, and the larger one is the one that would be quoted out loud — so read each with its own period or neither.",
  asOfLabel: "As of",
  noAsOfTitle: "This pack carries no timestamp",
  noAsOfBody: "Loqal does not yet stamp a pack with the moment it was built, so nothing on this screen tells a stale screenshot apart from a live figure. Refresh it in front of the shop.",
  refresh: "Refresh",
  blockedBody: "Too few shops trade in this category for an average to be a market fact. Below the floor it becomes one shop's private revenue, so Loqal does not show it — not to you, and not to them about you.",
  blockedReassure: "The same rule protects this shop's numbers the day it signs.",
  notMeasuredTitle: "Nothing measured yet",
  notMeasuredBody: "Enough shops trade here to report an average, and none of them has recorded a month of orders yet. That is an absence of data, not a figure being held back.",
  medianLabel: "Median orders a month",

  // -----------------------------------------------------------------------
  // /onboard
  // -----------------------------------------------------------------------
  stepClose: "How this closes",
  instagram: "Instagram",
  instagramHint: "For most shops this is the storefront. Paste the profile link.",
  website: "Website",
  optional: "optional",
  descriptionLabel: "What the shop sells",
  fileOnly: "File the application",
  fileOnlyBody: "Loqal reviews it later. No shop is created today, and terms cannot be set until an admin approves it.",
  closeNow: "Approve now and create the shop",
  closeNowBody: "The application is approved and the shop exists on Loqal before you leave the counter. It needs a web address.",
  slugLabel: "Web address",
  slugHint: "Lowercase letters, numbers and single hyphens. This is how shoppers reach the shop.",
  slugInvalid: "Lowercase letters, numbers and single hyphens only.",
  slugSuggest: "Use the shop name",
  outcomeLabel: "What is about to happen",
  filedTitle: "Application filed",
  filedBody: "No shop was created. An admin reviews it and issues the invite.",
  createdTitle: "Shop created",
  createdBody: "The shop exists on Loqal now. Set the offer next.",
  goToTerms: "Set the offer",
  registerAnother: "Register another shop",
  submitFailed: "The shop was not registered. Nothing was saved — read the message and try again.",
  fieldRequired: "Required.",
  badEmail: "That is not an email address.",
  badPhone: "A phone number, between 8 and 20 characters.",
  badUrl: "A full web address, starting with https://.",
  tooLong: "Too long.",
  reviewTitle: "Before you send",
  back: "Back",
  startOver: "Clear and start over",
  draftNote: "Held on this phone for this browsing session only, and gone the moment the browser closes.",

  // -----------------------------------------------------------------------
  // /terms
  // -----------------------------------------------------------------------
  noBrandTitle: "No shop chosen yet",
  noBrandBody: "Register a shop first. The offer is set against a shop that already exists on Loqal.",
  brandNotFoundTitle: "No such shop",
  brandNotFoundBody: "There is nothing at this address. A shop signed by another rep answers the same way, on purpose — this screen cannot be used to find out which shops exist.",
  floorNote: "The lowest commission you may sign without an admin.",
  maxFreeNote: "The longest free period you may sign without an admin.",
  outOfBandOption: "Outside your band",
  noFreePeriod: "No free period",
  freeUntilLabel: "Free until",
  pickBoth: "Choose a commission and a free period.",
  refusedTitle: "Refused as outside the band",
  refusedBody: "The band changed since this screen opened. It has been reloaded — choose again. Nothing was saved, and nothing was silently corrected to fit.",
  sentTitle: "The offer is set",
  sentBody: "The shop now carries this commission and this free period. An admin can see it and change it; you cannot change it from here.",
  thenWhatSales: "Loqal's monthly fee is set per shop by an admin, so it is not shown here and is not part of what you agree at the counter.",

  // -------------------------------------------------------------------------
  // WHICH SHOPS A REP MAY ACTUALLY ACT ON.
  //
  // Added when the screens were built against the real sales plane rather than
  // against the pitch for it. Every sentence below describes a refusal the
  // backend already makes, in words a salesperson can repeat to a shop owner
  // without phoning the office. See src/app/(sales)/signed-brands.ts.
  // -------------------------------------------------------------------------
  signedHereOnlyTitle: "Shops you registered on this phone",
  signedHereOnlyBody: "Loqal has no route that lists the shops a rep has signed, so this is the list this phone kept while you worked. It is gone when the browser closes; the shops are not. A shop you signed on another device will not appear here and cannot be priced from here.",
  cannotPriceChip: "Cannot be priced here",
  notYoursTitle: "You cannot set the offer for this shop",
  notYoursBody: "Loqal ties a shop to the rep who approved its application, and this phone has no record of you approving this one. Nothing is shown as available, because pressing it would only produce a refusal — and the refusal reads the same whether the shop belongs to another rep, was approved by an admin, or does not exist at all. That is deliberate: this screen must not be usable to find out which shops Loqal has.",
  leadNotClosedTitle: "Filed as a lead, not closed",
  leadNotClosedBody: "No shop was created, so there is nothing to price yet. Register it again with a web address when the owner is ready to sign, and the offer becomes yours to set.",
  fileOnlyRepNote: "If an admin approves this application later, Loqal records the admin as the approver — not you — and the offer will have to be set by them. Closing it yourself is the only way it stays in your hands.",
  createdBoundNote: "Loqal recorded you as the rep who approved this application. That is what lets you set the offer, and it is the only thing that does.",
  payoutNotHere: "The account the shop is paid into is set by an admin. It is not shown on this screen and cannot be written from it.",
  fixedChargeNote: "A percentage of each order is the only commission that can be agreed here. A flat fee per order cannot be checked against the floor, so Loqal sends it to an admin instead.",
  violationsHiddenNote: "Loqal knows which figure was out of band but does not send that detail to this screen, so check both the commission and the free period against the band above.",
};

export type SalesCopy = typeof salesEn;
