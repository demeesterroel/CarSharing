// Shared bits — paper palette, i18n, primitives
// Used across all CarSharing Direction B files.

const paperB = {
  paper: '#f5f0e6',
  paperDeep: '#ebe3d2',
  paperDark: '#d9ceb2',
  ink: '#1a1a1a',
  inkDim: '#555047',
  inkMute: '#8a8273',
  accent: '#c44536',
  green: '#5a7a3c',
  blue: '#3d5a7a',
  amber: '#b87e0f',
  fontMono: '"Courier Prime", "IBM Plex Mono", ui-monospace, monospace',
  fontSerif: '"Fraunces", "Playfair Display", Georgia, serif',
  fontSans: '"Inter", -apple-system, system-ui, sans-serif',
};

// ── i18n
const strings = {
  nl: {
    coop: 'Coöperatieve · Antwerpen',
    // nav
    tabDashboard: 'Dashboard', tabRitten: 'Ritten', tabTanken: 'Tanken',
    tabReserve: 'Reserveren', tabKosten: 'Kosten', tabBack: 'Terug',
    // dashboard
    greeting: 'Hallo, Roeland', today: 'Vandaag', balance: 'Jaarsaldo',
    youGet: 'Je krijgt', youOwe: 'Te betalen',
    recentTrips: 'Recente ritten', recentFuel: 'Recente tankbeurten',
    upcoming: 'Komende reserveringen', seeAll: 'Alles zien',
    newTrip: 'Nieuwe rit', newFuel: 'Nieuwe tankbeurt', newExpense: 'Extra kost',
    newReserve: 'Reserveren', reserve: 'Reserveren',
    // form labels
    wagen: 'Wagen', bestuurder: 'Bestuurder', datum: 'Datum',
    startKm: 'Start km', eindKm: 'Eind km', afstand: 'Afstand',
    tarief: 'Tarief', parkingLoc: 'Parking locatie', gpsAuto: 'GPS herkend',
    kortingBasis: 'Korting (≤500 km)', kortingLang: 'Korting lange rit (>500 km)',
    tariefBase: 'Basis tarief', lange: 'Lange rit toeslag',
    geenKorting: 'Geen korting', totaal: 'Totaal',
    betaaldDoor: 'Betaald door', bedrag: 'Bedrag', liters: 'Liters',
    prijsL: 'Prijs per liter', station: 'Tankstation', volleTank: 'Volle tank?',
    kilostand: 'Kilometerstand', kilostandVereist: 'Vereist bij volle tank — zo berekenen we het verbruik',
    reden: 'Reden (optioneel)', van: 'Van', tot: 'Tot',
    // actions
    opslaan: 'Opslaan', ritOpslaan: 'Rit opslaan', tankOpslaan: 'Tankbon opslaan',
    kostOpslaan: 'Kost opslaan', reserveOpslaan: 'Reservering bevestigen',
    annuleer: 'Annuleren', bewaard: 'Bewaard',
    veegOmlaag: '≋ Trek omlaag om op te slaan ≋',
    laatLos: '↓ Laat los om af te scheuren ↓',
    eerlijkGedeeld: 'Eerlijk gedeeld', inDeKas: 'In de kas',
    // units
    trips: 'ritten', tripsThisYear: 'ritten dit jaar', km: 'km',
    fillups: 'tankbeurten', liter: 'liter',
    days: 'dagen', day: 'dag',
    // screens
    allTrips: 'Alle ritten', allFuel: 'Alle tankbeurten',
    reservations: 'Reserveringen', extraKosten: 'Extra kosten',
    filterAll: 'Alle', filterMine: 'Mijn',
    perCar: 'Per wagen', perPerson: 'Per persoon', date: 'Datum',
    maand: 'maand', maandTotaal: 'Totaal deze maand',
    totalThisMonth: 'Totaal deze maand',
    available: 'Beschikbaar', booked: 'Bezet', selected: 'Geselecteerd',
    week: 'Week', maintenance: 'Onderhoud', insurance: 'Verzekering',
    tax: 'Belasting', other: 'Andere', category: 'Categorie',
    noData: 'Nog niets te zien',
    settled: 'Vereffend',
    footer: '— Een eerlijk ritboek, gedeeld onder vrienden —',
    // Reservation status
    pending: 'In aanvraag', confirmed: 'Bevestigd', rejected: 'Geweigerd',
    waitingOwner: 'Wacht op bevestiging',
    conflictWarn: 'Er staat al een aanvraag op deze datum',
    conflictSub: 'Je mag toch indienen — de eigenaar beslist.',
    // Admin
    tabBeheer: 'Beheer',
    beheer: 'Beheer', beheerSub: 'Co-op administratie',
    beheerInbox: 'Te bevestigen', beheerMembers: 'Leden',
    beheerHygiene: 'Data-hygiëne', beheerSettle: 'Afrekening', beheerPayout: 'Uitbetaling',
    beheerFleet: 'Vloot',
    beheerWagens: 'Wagens', beheerPersonen: 'Personen', beheerBetalingen: 'Betalingen',
    inboxEmpty: 'Niets te bevestigen', approve: 'Bevestigen', reject: 'Weigeren',
    mailPreview: 'Mail naar aanvrager', daysAgo: 'd geleden',
    kmPrice: 'Km-prijs', kmPriceHelper: 'Km-prijs assistent',
    longThreshold: 'LONG-drempel',
    fixedYearCosts: 'Vaste jaarkosten', variableCosts: 'Variabele kosten',
    perKm: '/ km', costPrice: 'Kostprijs', currentPrice: 'Huidige prijs',
    suggestionShort: 'Advies', suggestionSurplus: 'Overschot', suggestionShortfall: 'Tekort',
    scenarioSlider: 'Scenario: als je dit vraagt…',
    breakdown: 'Opbouw', yearTotal: 'Jaartotaal',
    brandstof: 'Brandstof', onderhoudBkd: 'Onderhoud', verzekeringBkd: 'Verzekering',
    belastingBkd: 'Belasting', keuringBkd: 'Keuring', afschrijvingBkd: 'Afschrijving',
    editCar: 'Wagen bewerken', saveCar: 'Opslaan',
    broekScheuren: 'Eigenaar scheurt zijn broek niet',
    broekScheurenWarn: 'LET OP: eigenaar legt zelf bij',
    membersDiscounts: 'Kortingen',
    baseDiscount: 'Basis-korting (≤500 km)', longDiscountPct: 'Lange-rit korting (>500 km)',
    hasDiscount: 'Heeft korting', noDiscountShort: 'Volle prijs',
    kmGaps: 'Gaten in kilometerstand', fuelSuspect: 'Verdachte tankbeurten',
    assignToMember: 'Toewijzen aan lid', assignGhost: 'Coöperatief (geen bestuurder)',
    splitFuel: 'Splitsen in meerdere tankbeurten',
    missing: 'ontbreekt', suspect: 'verdacht',
    settlement: 'Jaarafrekening 2026',
    runSettlement: 'Afrekening genereren',
    payBack: 'Terug te betalen', toPay: 'Bij te betalen', paysZero: 'Quitte',
    totalCredits: 'Totaal credits', totalDebits: 'Totaal debits', mustBalance: 'Moet nul zijn',
    copyInstructions: 'Betaalinstructies kopiëren',
    payouts: 'Eigenaar-uitbetaling', payoutSub: 'Na afrekening van alle leden',
    carRevenue: 'Rit-opbrengst', carFuel: 'Brandstof', carMaint: 'Onderhoud',
    carFixed: 'Vaste kosten', ownerNet: 'Netto naar eigenaar',
    exportCsv: 'CSV exporteren', exportPdf: 'PDF', asPaid: 'Gemarkeerd als betaald',
    coopFairness: 'Elke eigenaar wordt nu correct vergoed — niemand schiet nog voor.',
    settlementMath: 'Lid betaalt = ritten − voorgeschoten brandstof − voorgeschoten onderhoud',
    pendingBadge: 'In aanvraag',
    maybeBusy: 'Mogelijk bezet',
    myRequest: 'Jouw aanvraag',
    forApproval: 'Jouw wagens',
  },
  en: {
    coop: 'Cooperative · Antwerp',
    tabDashboard: 'Dashboard', tabRitten: 'Trips', tabTanken: 'Fuel',
    tabReserve: 'Reserve', tabKosten: 'Costs', tabBack: 'Back',
    greeting: 'Hello, Roeland', today: 'Today', balance: 'Year balance',
    youGet: 'You receive', youOwe: 'You owe',
    recentTrips: 'Recent trips', recentFuel: 'Recent fill-ups',
    upcoming: 'Upcoming reservations', seeAll: 'See all',
    newTrip: 'New trip', newFuel: 'New fuel', newExpense: 'New cost',
    newReserve: 'Reserve', reserve: 'Reserve',
    wagen: 'Car', bestuurder: 'Driver', datum: 'Date',
    startKm: 'Start km', eindKm: 'End km', afstand: 'Distance',
    tarief: 'Rate', parkingLoc: 'Parking location', gpsAuto: 'GPS detected',
    kortingBasis: 'Discount (≤500 km)', kortingLang: 'Long-trip discount (>500 km)',
    tariefBase: 'Base rate', lange: 'Long-trip portion',
    geenKorting: 'No discount', totaal: 'Total',
    betaaldDoor: 'Paid by', bedrag: 'Amount', liters: 'Litres',
    prijsL: 'Price per litre', station: 'Fuel station', volleTank: 'Full tank?',
    kilostand: 'Odometer', kilostandVereist: 'Required if full tank — so we can compute consumption',
    reden: 'Reason (optional)', van: 'From', tot: 'To',
    opslaan: 'Save', ritOpslaan: 'Save trip', tankOpslaan: 'Save receipt',
    kostOpslaan: 'Save cost', reserveOpslaan: 'Confirm reservation',
    annuleer: 'Cancel', bewaard: 'Saved',
    veegOmlaag: '≋ Pull down to save ≋', laatLos: '↓ Release to tear off ↓',
    eerlijkGedeeld: 'Fairly shared', inDeKas: 'In the fund',
    trips: 'trips', tripsThisYear: 'trips this year', km: 'km',
    fillups: 'fill-ups', liter: 'litres',
    days: 'days', day: 'day',
    allTrips: 'All trips', allFuel: 'All fill-ups',
    reservations: 'Reservations', extraKosten: 'Extra costs',
    filterAll: 'All', filterMine: 'Mine',
    perCar: 'Per car', perPerson: 'Per person', date: 'Date',
    maand: 'month', maandTotaal: 'Month total',
    totalThisMonth: 'Total this month',
    available: 'Available', booked: 'Booked', selected: 'Selected',
    week: 'Week', maintenance: 'Maintenance', insurance: 'Insurance',
    tax: 'Tax', other: 'Other', category: 'Category',
    noData: 'Nothing yet',
    settled: 'Settled',
    footer: '— An honest ledger, shared between friends —',
    pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected',
    waitingOwner: 'Waiting for owner approval',
    conflictWarn: 'A request already exists for this date',
    conflictSub: 'You can still submit — the owner decides.',
    tabBeheer: 'Admin',
    beheer: 'Admin', beheerSub: 'Co-op administration',
    beheerInbox: 'To approve', beheerMembers: 'Members',
    beheerHygiene: 'Data hygiene', beheerSettle: 'Settlement', beheerPayout: 'Payout',
    beheerFleet: 'Fleet',
    beheerWagens: 'Cars', beheerPersonen: 'People', beheerBetalingen: 'Payments',
    inboxEmpty: 'Nothing to approve', approve: 'Approve', reject: 'Reject',
    mailPreview: 'Mail to requester', daysAgo: 'd ago',
    kmPrice: 'Km rate', kmPriceHelper: 'Km-rate assistant',
    longThreshold: 'Long threshold',
    fixedYearCosts: 'Fixed yearly costs', variableCosts: 'Variable costs',
    perKm: '/ km', costPrice: 'Cost price', currentPrice: 'Current price',
    suggestionShort: 'Advice', suggestionSurplus: 'Surplus', suggestionShortfall: 'Shortfall',
    scenarioSlider: 'Scenario: if you charge…',
    breakdown: 'Breakdown', yearTotal: 'Year total',
    brandstof: 'Fuel', onderhoudBkd: 'Maintenance', verzekeringBkd: 'Insurance',
    belastingBkd: 'Tax', keuringBkd: 'Inspection', afschrijvingBkd: 'Depreciation',
    editCar: 'Edit car', saveCar: 'Save',
    broekScheuren: "Owner isn't losing money",
    broekScheurenWarn: 'WARNING: owner subsidising',
    membersDiscounts: 'Discounts',
    baseDiscount: 'Base discount (≤500 km)', longDiscountPct: 'Long-trip discount (>500 km)',
    hasDiscount: 'Has discount', noDiscountShort: 'Full price',
    kmGaps: 'Odometer gaps', fuelSuspect: 'Suspicious fuel fills',
    assignToMember: 'Assign to member', assignGhost: 'Co-op (no driver)',
    splitFuel: 'Split into multiple fills',
    missing: 'missing', suspect: 'suspect',
    settlement: 'Year settlement 2026',
    runSettlement: 'Generate settlement',
    payBack: 'To refund', toPay: 'To charge', paysZero: 'Even',
    totalCredits: 'Total credits', totalDebits: 'Total debits', mustBalance: 'Must be zero',
    copyInstructions: 'Copy payment instructions',
    payouts: 'Owner payout', payoutSub: 'After members settle up',
    carRevenue: 'Trip revenue', carFuel: 'Fuel', carMaint: 'Maintenance',
    carFixed: 'Fixed costs', ownerNet: 'Net to owner',
    exportCsv: 'Export CSV', exportPdf: 'PDF', asPaid: 'Marked paid',
    coopFairness: 'Every owner is now fairly compensated — nobody subsidises.',
    settlementMath: 'Member pays = trips − fuel advanced − maintenance advanced',
    pendingBadge: 'Pending',
    maybeBusy: 'Possibly busy',
    myRequest: 'Your request',
    forApproval: 'Your cars',
  },
};

// ── Auth / Role context
const RoleContext = React.createContext({ role: 'user', me: '', caps: {}, person: null });
const useRole = () => React.useContext(RoleContext);

// Derive caps from person + CARS data
function roleCaps(person) {
  if (!person) return { canSeeBeheer: false, canApprove: false, pickAnyDriver: false, ownedCars: [], isOwner: false, isAdmin: false };
  const ownedCars = CARS.filter(c => (c.ownerIds || [c.eigenaar]).includes(person.name)).map(c => c.short);
  const isAdmin   = person.isAdmin || false;
  const isOwner   = ownedCars.length > 0;
  return {
    canSeeBeheer:  isAdmin || isOwner,
    canApprove:    isAdmin || isOwner,
    pickAnyDriver: isAdmin,
    ownedCars,
    isOwner,
    isAdmin,
  };
}

// ── Login page — paper receipt aesthetic
function LoginPage({ lang, setLang, onLogin }) {
  const t = strings[lang];
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError]       = React.useState('');
  const [loading, setLoading]   = React.useState(false);

  const handleSubmit = (e) => {
    e && e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const person = PEOPLE.find(p => p.username === username.trim().toLowerCase() && p.password === password);
      if (!person) {
        setError(lang === 'nl' ? 'Ongeldig gebruikersnaam of wachtwoord.' : 'Invalid username or password.');
        setLoading(false);
        return;
      }
      setError('');
      onLogin(person);
    }, 300);
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    fontFamily: paperB.fontMono, fontSize: 13,
    border: `1.5px solid ${paperB.ink}`,
    background: paperB.paperDeep, color: paperB.ink,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
    letterSpacing: 2, textTransform: 'uppercase',
    display: 'block', marginBottom: 5,
  };

  return (
    <div style={{
      minHeight: '100dvh', background: paperB.paperDeep,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
          letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
        }}>{t.coop}</div>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 32, fontWeight: 700,
          color: paperB.ink, lineHeight: 1,
        }}>Autodelen</div>
        <div style={{
          width: 40, height: 2, background: paperB.ink,
          margin: '10px auto 0',
        }}/>
      </div>

      {/* Receipt card */}
      <div style={{
        background: paperB.paper, padding: '28px 24px 24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.10)',
        width: '100%', maxWidth: 340,
      }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2.5,
          textTransform: 'uppercase', color: paperB.inkDim,
          textAlign: 'center', marginBottom: 20,
        }}>— {lang === 'nl' ? 'Aanmelden' : 'Sign in'} —</div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{lang === 'nl' ? 'Gebruikersnaam' : 'Username'}</label>
            <input
              autoFocus autoComplete="username"
              value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{lang === 'nl' ? 'Wachtwoord' : 'Password'}</label>
            <input
              type="password" autoComplete="current-password"
              value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 10, color: paperB.accent,
              marginBottom: 14, padding: '8px 10px',
              border: `1px solid ${paperB.accent}`, background: '#fdf4f3',
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px',
            background: loading ? paperB.inkMute : paperB.ink,
            color: paperB.paper, border: 'none', cursor: loading ? 'default' : 'pointer',
            fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
            letterSpacing: 2.5, textTransform: 'uppercase',
          }}>
            {loading ? '…' : (lang === 'nl' ? 'Aanmelden' : 'Sign in')}
          </button>
        </form>

        <div style={{
          marginTop: 18, borderTop: `1px dashed ${paperB.paperDark}`, paddingTop: 14,
          fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
          textAlign: 'center', letterSpacing: 1, lineHeight: 1.6,
        }}>
          {lang === 'nl' ? 'Gebruik je voornaam als gebruikersnaam.' : 'Use your first name as username.'}
        </div>
      </div>

      {/* Lang toggle */}
      <div style={{ marginTop: 20 }}>
        <LangToggle lang={lang} setLang={setLang}/>
      </div>

      <div style={{
        marginTop: 28, fontFamily: paperB.fontMono, fontSize: 8,
        color: paperB.inkMute, letterSpacing: 1, textTransform: 'uppercase',
      }}>{t.footer}</div>
    </div>
  );
}

// ── primitives
function Perf({ margin = '12px 0' }) {
  return <div style={{ height: 1, borderTop: `1.5px dashed ${paperB.ink}`, margin }}/>;
}

function ReceiptRow({ label, value, big, accent, color }) {
  const c = color || (accent ? paperB.accent : paperB.ink);
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontFamily: paperB.fontMono,
      padding: '4px 0',
    }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: big ? 11 : 10, color: paperB.inkDim, whiteSpace: 'nowrap', marginRight: 12 }}>{label}</span>
      <span style={{ fontWeight: big ? 700 : 500, fontSize: big ? 17 : 13, whiteSpace: 'nowrap', color: c }}>{value}</span>
    </div>
  );
}

function Stamp({ children, rotate = -6, color = paperB.accent, size = 'md' }) {
  const s = size === 'sm' ? { pad: '4px 10px', font: 9 } : { pad: '6px 14px', font: 11 };
  return (
    <div style={{
      display: 'inline-block', padding: s.pad,
      border: `2.5px solid ${color}`, borderRadius: 4, color,
      fontFamily: paperB.fontMono, fontSize: s.font, fontWeight: 700,
      letterSpacing: 2, textTransform: 'uppercase',
      transform: `rotate(${rotate}deg)`, opacity: 0.9,
    }}>{children}</div>
  );
}

function CarStamp({ code, active, size = 'md' }) {
  const s = size === 'sm' ? { pad: '4px 8px', font: 10 } : { pad: '10px 8px', font: 13 };
  return (
    <div style={{
      padding: s.pad, textAlign: 'center',
      border: `1.5px ${active ? 'solid' : 'dashed'} ${paperB.ink}`,
      background: active ? paperB.ink : 'transparent',
      color: active ? paperB.paper : paperB.ink,
      fontFamily: paperB.fontMono, fontSize: s.font, fontWeight: 700, letterSpacing: 2,
      display: 'inline-block', minWidth: 44,
    }}>{code}</div>
  );
}

// Interactive car picker
function CarPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {CARS.map(c => (
        <button key={c.short} onClick={() => onChange(c.short)} style={{
          flex: 1, padding: '10px 6px',
          border: `1.5px ${c.short === value ? 'solid' : 'dashed'} ${paperB.ink}`,
          background: c.short === value ? paperB.ink : 'transparent',
          color: c.short === value ? paperB.paper : paperB.ink,
          fontFamily: paperB.fontMono, fontWeight: 700,
          letterSpacing: 2, cursor: 'pointer',
          transform: c.short === value ? 'rotate(-1deg)' : 'none',
          transition: 'transform 0.15s',
        }}>
          <div style={{ fontSize: 13 }}>{c.short}</div>
          <div style={{ fontSize: 8, opacity: 0.65, letterSpacing: 0.5, marginTop: 3, textTransform: 'none', fontWeight: 500 }}>{c.merk}</div>
        </button>
      ))}
    </div>
  );
}

// Person picker — a grid of initials
function PersonPicker({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {PEOPLE.map(p => {
        const sel = p.name === value;
        return (
          <button key={p.name} onClick={() => onChange(p.name)} style={{
            padding: '8px 2px',
            border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
            background: sel ? paperB.ink : paperB.paper,
            color: sel ? paperB.paper : paperB.ink,
            fontFamily: paperB.fontMono, fontSize: 9, fontWeight: 700,
            letterSpacing: 0.5, cursor: 'pointer', lineHeight: 1.1,
            transform: sel ? 'rotate(-2deg)' : 'none', transition: 'transform 0.15s',
          }}>
            {p.name.slice(0, 5)}
            {(p.k > 0) && (
              <div style={{
                fontSize: 7, marginTop: 2,
                color: sel ? paperB.paper : paperB.accent,
                opacity: sel ? 0.7 : 1,
              }}>★</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function InputLineB({ label, value, onChange, suffix, underlined = true, type = 'text', placeholder, readOnly }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
      }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        borderBottom: underlined ? `1.5px solid ${paperB.ink}` : 'none',
        paddingBottom: 4,
      }}>
        {onChange && !readOnly ? (
          <input
            type={type} value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              fontFamily: paperB.fontSerif, fontSize: 22, color: paperB.ink,
              flex: 1, fontWeight: 500, background: 'transparent',
              border: 'none', outline: 'none', padding: 0, minWidth: 0,
            }}
          />
        ) : (
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 22, color: paperB.ink,
            flex: 1, fontWeight: 500, wordBreak: 'break-word',
          }}>{value || <span style={{ color: paperB.inkMute, fontStyle: 'italic' }}>{placeholder}</span>}</div>
        )}
        {suffix && <div style={{ fontFamily: paperB.fontMono, fontSize: 13, color: paperB.inkDim, marginLeft: 8 }}>{suffix}</div>}
      </div>
    </div>
  );
}

// Language toggle
function LangToggle({ lang, setLang }) {
  return (
    <div style={{
      display: 'inline-flex', fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
      border: `1.5px solid ${paperB.ink}`, overflow: 'hidden',
    }}>
      {['nl','en'].map(l => (
        <div key={l} onClick={() => setLang(l)} style={{
          padding: '3px 8px', cursor: 'pointer',
          background: lang === l ? paperB.ink : 'transparent',
          color: lang === l ? paperB.paper : paperB.ink,
          fontWeight: 700,
        }}>{l.toUpperCase()}</div>
      ))}
    </div>
  );
}

Object.assign(window, {
  paperB, strings,
  Perf, ReceiptRow, Stamp, CarStamp, CarPicker, PersonPicker, InputLineB, LangToggle,
  RoleContext, useRole, roleCaps, LoginPage,
});
