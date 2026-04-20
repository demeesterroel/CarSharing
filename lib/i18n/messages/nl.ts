export const nl = {
  // Brand
  "brand.app": "Autodelen",
  "brand.description": "Autodelen voor een coöperatieve",

  // Primary navigation (drawer + bottom tab bar)
  "nav.menu": "Menu",
  "nav.primary": "Hoofdnavigatie",
  "nav.dashboard": "Dashboard",
  "nav.calendar": "Kalender",
  "nav.people": "Personen",
  "nav.cars": "Wagens",
  "nav.expenses": "Extra Kosten",
  "nav.payments": "Betalingen",
  "nav.trips": "Kilometers",
  "nav.fuel": "Tanken",
  "nav.logout": "Uitloggen",

  // Page headers (shown inside <PageHeader title={...} />)
  "page.dashboard": "Dashboard",
  "page.dashboard_coming_soon": "Dashboard binnenkort beschikbaar.",
  "page.calendar": "Kalender",
  "page.people": "Personen",
  "page.cars": "Wagens",
  "page.trips": "Kilometers",
  "page.fuel": "Tanken",
  "page.expenses": "Extra Kosten",
  "page.payments": "Betalingen",

  // Dialog titles / FAB aria-labels (reused in both slots — same action, same copy)
  "page.person_add": "Persoon toevoegen",
  "page.person_edit": "Persoon bewerken",
  "page.car_add": "Wagen toevoegen",
  "page.car_edit": "Wagen bewerken",
  "page.trip_add": "Rit toevoegen",
  "page.trip_edit": "Rit bewerken",
  "page.fuel_add": "Tankbeurt toevoegen",
  "page.fuel_edit": "Tankbeurt bewerken",
  "page.expense_add": "Kost toevoegen",
  "page.expense_edit": "Kost bewerken",
  "page.payment_add": "Betaling toevoegen",
  "page.payment_edit": "Betaling bewerken",
  "page.reservation_add": "Reservering toevoegen",
  "page.reservation_edit": "Reservering bewerken",

  // Actions (buttons, generic FAB)
  "action.add": "Toevoegen",
  "action.login": "Inloggen",
  "action.save": "Opslaan",
  "action.cancel": "Annuleer",
  "action.delete": "Verwijderen",

  // Form labels (asterisked keys are required; non-asterisked are optional)
  "form.name": "Naam *",
  "form.password": "Wachtwoord",
  "form.discount": "Korting (0–1)",
  "form.discount_long": "Korting lang (0–1)",
  "form.active_member": "Actief lid",
  "form.car": "Wagen *",
  "form.car_short": "Code (ETH/JF/LEW) *",
  "form.price_per_km": "Prijs/km *",
  "form.price_per_liter": "Prijs/liter",
  "form.brand": "Merk",
  "form.color": "Kleur",
  "form.date": "Datum *",
  "form.date_from": "Van *",
  "form.date_to": "Tot *",
  "form.start_odometer": "Start *",
  "form.end_odometer": "Eind *",
  "form.odometer": "Kilometerstand",
  "form.km": "KM",
  "form.amount": "Bedrag",
  "form.amount_euro_required": "Bedrag (€) *",
  "form.amount_euro": "Bedrag (€)",
  "form.liters": "# Liter *",
  "form.location": "Locatie",
  "form.location_placeholder": "Klik op kaart of gebruik GPS",
  "form.receipt": "Bonnetje",
  "form.receipt_add": "Bonnetje toevoegen",
  "form.description": "Omschrijving",
  "form.description_placeholder": "bv. Verkeersbelasting",
  "form.note": "Opmerking",
  "form.note_placeholder": "bv. Vereffening 2025",
  "form.select_person_placeholder": "Selecteer persoon",

  // Form validation messages (shown under fields)
  "validation.name_required": "Naam is verplicht",
  "validation.person_required": "Kies een persoon",
  "validation.car_required": "Kies een wagen",
  "validation.end_gte_start": "Eind moet ≥ start zijn",
  "validation.end_date_gte_start": "Einde moet op of na start liggen",

  // Toast notifications
  "toast.saved": "Opgeslagen",
  "toast.deleted": "Verwijderd",
  "toast.person_added": "Persoon toegevoegd",
  "toast.car_added": "Wagen toegevoegd",
  "toast.trip_saved": "Rit opgeslagen",
  "toast.trip_deleted": "Rit verwijderd",
  "toast.fuel_saved": "Tankbeurt opgeslagen",
  "toast.payment_saved": "Betaling opgeslagen",
  "toast.reservation_saved": "Reservering opgeslagen",

  // UI states
  "state.loading": "Laden...",
  "state.uploading": "Uploaden...",

  // Errors shown inline
  "error.gps_unavailable": "GPS niet beschikbaar",
  "error.invalid_credentials": "Ongeldige gebruikersnaam of wachtwoord",

  // Dashboard balance labels (take {amount} placeholder)
  "balance.settled": "vereffend",
  "balance.credit": "Je krijgt €{amount}",
  "balance.debt": "Je bent €{amount} verschuldigd",
} as const;

export type Messages = typeof nl;
export type MessageKey = keyof Messages;
