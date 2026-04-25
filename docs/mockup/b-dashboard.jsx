// Dashboard + recent lists + FAB + bottom nav

function StatementHeader({ lang, setLang }) {
  const t = strings[lang];
  const { me, role } = useRole();
  const today = lang === 'nl' ? 'di 21 apr 2026' : 'Tue 21 Apr 2026';
  const greet = lang === 'nl' ? `Hallo, ${me}` : `Hello, ${me}`;
  const { caps } = useRole();
  const roleIcon  = caps.isAdmin ? '✦' : caps.isOwner ? '◉' : '◐';
  const roleLabel = caps.isAdmin
    ? (lang === 'nl' ? 'Admin' : 'Admin')
    : caps.isOwner
      ? (lang === 'nl' ? 'Eigenaar' : 'Owner')
      : (lang === 'nl' ? 'Lid' : 'Member');
  return (
    <div style={{
      background: paperB.paper,
      padding: '22px 20px 22px',
      borderBottom: `1.5px dashed ${paperB.ink}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 2, textTransform: 'uppercase',
        }}>{t.coop}</div>
        <LangToggle lang={lang} setLang={setLang}/>
      </div>
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 32, fontWeight: 700,
        color: paperB.ink, letterSpacing: -0.8, lineHeight: 1.05,
      }}>{greet}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
        letterSpacing: 2, textTransform: 'uppercase', marginTop: 6,
      }}>
        <span style={{
          padding: '2px 6px', border: `1.5px solid ${paperB.ink}`,
          color: paperB.ink, fontWeight: 700,
        }}>{roleIcon} {roleLabel}</span>
        <span>{t.today} · {today}</span>
      </div>
    </div>
  );
}

function BalanceReceipt({ lang }) {
  const t = strings[lang];
  const s = myYearStats();
  const positive = s.balance > 0;
  return (
    <div style={{ padding: '18px 16px 0' }}>
      <div style={{
        background: paperB.paper, padding: '20px 18px 22px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
          letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center',
          fontWeight: 700,
        }}>— {t.balance} 2026 —</div>
        <Perf margin="10px 0 12px"/>

        <ReceiptRow label={lang === 'nl' ? 'Jouw ritten'      : 'Your trips'}       value={'− ' + fmtMoney(s.tripsCost)}/>
        <ReceiptRow label={lang === 'nl' ? 'Jouw tankbeurten' : 'Your fuel paid'}   value={fmtMoney(s.fuelPaid)}/>
        <ReceiptRow label={lang === 'nl' ? 'Jouw onderhoud'   : 'Your maintenance'} value={fmtMoney(s.expPaid)}/>

        <Perf margin="10px 0"/>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '4px 0',
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase', color: paperB.inkDim,
            whiteSpace: 'nowrap', marginRight: 12,
          }}>{positive ? t.youGet : t.youOwe}</div>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 34, fontWeight: 700,
            color: positive ? paperB.green : paperB.accent,
            letterSpacing: -1, lineHeight: 1, whiteSpace: 'nowrap',
          }}>{positive ? '+ ' : '− '}{fmtMoney(Math.abs(s.balance)).replace('€ ','€ ')}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Stamp rotate={-5} color={positive ? paperB.green : paperB.accent}>
            {positive ? (lang === 'nl' ? 'Tegoed' : 'Credit')
                      : (lang === 'nl' ? 'Te betalen' : 'To pay')}
          </Stamp>
        </div>

        <Perf margin="16px 0 12px"/>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { n: String(s.trips),  l: t.tripsThisYear },
            { n: s.km.toLocaleString('nl-BE'), l: t.km },
            { n: String(s.fillups), l: t.fillups },
          ].map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 22, fontWeight: 700,
                color: paperB.ink, lineHeight: 1,
              }}>{x.n}</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4,
              }}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '24px 24px 10px',
    }}>
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 20, fontWeight: 700,
        color: paperB.ink, letterSpacing: -0.3,
      }}>{title}</div>
      {action && (
        <div onClick={onAction} style={{
          cursor: 'pointer',
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1.5, textTransform: 'uppercase',
          borderBottom: `1px solid ${paperB.inkDim}`,
        }}>{action} →</div>
      )}
    </div>
  );
}

function TripStrip({ trip, lang, mine }) {
  const t = strings[lang];
  return (
    <div style={{
      background: paperB.paper, padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      borderLeft: `3px solid ${paperB.ink}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <CarStamp code={trip.car} active size="sm"/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink,
          fontWeight: 600, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{trip.parking}</div>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1, marginTop: 2,
        }}>
          {trip.who} · {fmtDate(trip.date, lang)} · {trip.km.toLocaleString('nl-BE')} {t.km}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 14, fontWeight: 700,
          color: paperB.ink, whiteSpace: 'nowrap',
        }}>{fmtMoney(trip.total)}</div>
      </div>
    </div>
  );
}

function FuelStrip({ fuel, lang }) {
  return (
    <div style={{
      background: paperB.paper, padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      borderLeft: `3px solid ${paperB.accent}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <CarStamp code={fuel.car} active size="sm"/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink,
          fontWeight: 600, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>⛽ {fuel.location}{fuel.vol ? ' ·' : ''}{fuel.vol ? ' volle tank' : ''}</div>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1, marginTop: 2,
        }}>
          {fuel.who} · {fmtDate(fuel.date, lang)} · {fuel.liter.toFixed(1)}L
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 14, fontWeight: 700,
          color: paperB.accent, whiteSpace: 'nowrap',
        }}>{fmtMoney(fuel.bedrag)}</div>
      </div>
    </div>
  );
}

function ResStrip({ r, lang }) {
  const car = carByShort[r.car];
  const singleDay = r.from === r.to;
  return (
    <div style={{
      background: paperB.paper, padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      borderLeft: `3px dashed ${paperB.blue}`,
    }}>
      <CarStamp code={r.car} active size="sm"/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink,
          fontWeight: 600, lineHeight: 1.2,
        }}>{r.reason}</div>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1, marginTop: 2,
        }}>
          {r.who} · {fmtDate(r.from, lang)}
          {!singleDay && <> → {fmtDate(r.to, lang)}</>}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ lang, setLang, onNavigate }) {
  const t = strings[lang];
  const upcoming = RESERVATIONS.slice(0, 2);
  return (
    <div style={{ background: paperB.paperDeep, minHeight: '100%', paddingBottom: 140 }}>
      <StatementHeader lang={lang} setLang={setLang}/>
      <BalanceReceipt lang={lang}/>

      <SectionHeader title={t.upcoming} action={t.seeAll} onAction={() => onNavigate('reserve')}/>
      <div style={{ padding: '0 16px' }}>
        {upcoming.map(r => <ResStrip key={r.id} r={r} lang={lang}/>)}
      </div>

      <SectionHeader title={t.recentTrips} action={t.seeAll} onAction={() => onNavigate('trips')}/>
      <div style={{ padding: '0 16px' }}>
        {RECENT_TRIPS.slice(0, 3).map(tr => <TripStrip key={tr.id} trip={tr} lang={lang}/>)}
      </div>

      <SectionHeader title={t.recentFuel} action={t.seeAll} onAction={() => onNavigate('fuel')}/>
      <div style={{ padding: '0 16px' }}>
        {RECENT_FUEL.slice(0, 2).map(f => <FuelStrip key={f.id} fuel={f} lang={lang}/>)}
      </div>

      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 12, fontStyle: 'italic',
        color: paperB.inkMute, textAlign: 'center',
        padding: '32px 32px 20px', lineHeight: 1.5,
      }}>{t.footer}</div>
    </div>
  );
}

// ── FAB (handwritten chit menu)
function FAB({ lang, onPick }) {
  const [open, setOpen] = React.useState(false);
  const t = strings[lang];
  const chit = (label, emoji, action, rotate) => (
    <button onClick={() => { setOpen(false); onPick(action); }} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', background: paperB.paper,
      border: `1.5px solid ${paperB.ink}`, borderRadius: 0, cursor: 'pointer',
      fontFamily: paperB.fontMono, fontSize: 11, letterSpacing: 2,
      textTransform: 'uppercase', fontWeight: 700, color: paperB.ink,
      transform: `rotate(${rotate}deg)`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'popIn 0.2s ease-out',
    }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>{label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 86, zIndex: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
    }}>
      {open && <div onClick={() => setOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.2)',
        backdropFilter: 'blur(2px)', zIndex: -1,
      }}/>}

      {open && <>
        {chit(t.newExpense, '🧾', 'expense', 2)}
        {chit(t.newReserve, '📅', 'reserve', -2)}
        {chit(t.newFuel,    '⛽', 'fuel', 1)}
        {chit(t.newTrip,    '🚗', 'trip', -1)}
      </>}

      <button onClick={() => setOpen(o => !o)} style={{
        width: 60, height: 60, background: paperB.ink, color: paperB.paper,
        border: 'none', borderRadius: 0, cursor: 'pointer',
        fontFamily: paperB.fontSerif, fontSize: 34, fontWeight: 700,
        lineHeight: 1, boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease-out',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><span style={{ marginTop: -3 }}>+</span></button>
    </div>
  );
}

// ── Bottom nav (paper tabs)
function BottomNav({ tab, setTab, lang }) {
  const t = strings[lang];
  const { caps } = useRole();
  let items = [
    { k: 'dashboard', l: t.tabDashboard, i: '◉' },
    { k: 'trips',     l: t.tabRitten,    i: '↦' },
    { k: 'fuel',      l: t.tabTanken,    i: '⛽' },
    { k: 'reserve',   l: t.tabReserve,   i: '▦' },
    { k: 'kosten',    l: t.tabKosten,    i: '₪' },
    { k: 'admin',     l: t.tabBeheer,    i: '✎' },
  ];
  if (!caps.canSeeBeheer) items = items.filter(x => x.k !== 'admin');
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
      background: paperB.paper,
      borderTop: `1.5px dashed ${paperB.ink}`,
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
    }}>
      {items.map(it => {
        const active = it.k === tab;
        return (
          <button key={it.k} onClick={() => setTab(it.k)} style={{
            flex: 1, padding: '10px 2px 12px', border: 'none',
            background: active ? paperB.ink : 'transparent',
            color: active ? paperB.paper : paperB.ink,
            cursor: 'pointer', fontFamily: paperB.fontMono,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            minWidth: 0,
          }}>
            <div style={{ fontSize: 15, lineHeight: 1 }}>{it.i}</div>
            <div style={{
              fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>{it.l}</div>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { Dashboard, FAB, BottomNav });
