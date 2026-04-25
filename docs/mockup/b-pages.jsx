// History screens: All trips, All fuel, Reservations calendar, Extra kosten

// Generic page header
function PageHeader({ title, lang, setLang }) {
  const t = strings[lang];
  return (
    <div style={{
      background: paperB.paper, padding: '20px 20px 18px',
      borderBottom: `1.5px dashed ${paperB.ink}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 2, textTransform: 'uppercase',
        }}>{t.coop}</div>
        <LangToggle lang={lang} setLang={setLang}/>
      </div>
      <div style={{
        fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
        color: paperB.ink, letterSpacing: -0.5, lineHeight: 1.05,
      }}>{title}</div>
    </div>
  );
}

// Filter chip row
function FilterRow({ options, value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto',
      background: paperB.paperDeep, borderBottom: `1px solid ${paperB.paperDark}`,
    }}>
      {options.map(o => {
        const sel = o.k === value;
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            padding: '6px 12px', flexShrink: 0,
            border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
            background: sel ? paperB.ink : paperB.paper,
            color: sel ? paperB.paper : paperB.ink, cursor: 'pointer',
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
            textTransform: 'uppercase', fontWeight: 700,
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

function groupByMonth(items, dateKey, lang) {
  const groups = {};
  for (const it of items) {
    const d = new Date(it[dateKey]);
    const key = d.getFullYear() + '-' + String(d.getMonth()).padStart(2,'0');
    if (!groups[key]) {
      groups[key] = {
        key,
        label: (lang === 'nl' ? MONTHS_NL : MONTHS_EN)[d.getMonth()] + ' ' + d.getFullYear(),
        items: [],
      };
    }
    groups[key].items.push(it);
  }
  return Object.values(groups).sort((a,b) => b.key.localeCompare(a.key));
}

// ═══════════ All Trips ═══════════
function AllTripsPage({ lang, setLang }) {
  const t = strings[lang];
  const { me } = useRole();
  const [filter, setFilter] = React.useState('mine');
  const [carFilter, setCarFilter] = React.useState('all');

  let items = [...RECENT_TRIPS];
  if (filter === 'mine') items = items.filter(x => x.who === me);
  if (carFilter !== 'all') items = items.filter(x => x.car === carFilter);
  items.sort((a,b) => b.date.localeCompare(a.date));
  const groups = groupByMonth(items, 'date', lang);

  return (
    <div style={{ background: paperB.paperDeep, minHeight: '100%', paddingBottom: 120 }}>
      <PageHeader title={t.allTrips} lang={lang} setLang={setLang}/>
      <FilterRow value={filter} onChange={setFilter} options={[
        { k: 'mine', l: t.filterMine }, { k: 'all', l: t.filterAll },
      ]}/>
      <FilterRow value={carFilter} onChange={setCarFilter} options={[
        { k: 'all', l: t.allCars || t.filterAll },
        ...CARS.map(c => ({ k: c.short, l: c.short })),
      ]}/>

      {groups.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center',
          fontFamily: paperB.fontSerif, color: paperB.inkMute, fontStyle: 'italic',
        }}>{t.noData}</div>
      )}

      {groups.map(g => {
        const total = g.items.reduce((s,x) => s + x.total, 0);
        const km = g.items.reduce((s,x) => s + x.km, 0);
        return (
          <div key={g.key}>
            <div style={{
              padding: '18px 20px 6px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
                letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
              }}>— {g.label} —</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
                letterSpacing: 1,
              }}>{km.toLocaleString('nl-BE')} km · {fmtMoney(total)}</div>
            </div>
            <div style={{ padding: '0 16px' }}>
              {g.items.map(tr => <TripStrip key={tr.id} trip={tr} lang={lang}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════ All Fuel ═══════════
function AllFuelPage({ lang, setLang }) {
  const t = strings[lang];
  const { me } = useRole();
  const [filter, setFilter] = React.useState('mine');
  const [carFilter, setCarFilter] = React.useState('all');

  let items = [...RECENT_FUEL];
  if (filter === 'mine') items = items.filter(x => x.who === me);
  if (carFilter !== 'all') items = items.filter(x => x.car === carFilter);
  items.sort((a,b) => b.date.localeCompare(a.date));
  const groups = groupByMonth(items, 'date', lang);

  return (
    <div style={{ background: paperB.paperDeep, minHeight: '100%', paddingBottom: 120 }}>
      <PageHeader title={t.allFuel} lang={lang} setLang={setLang}/>
      <FilterRow value={filter} onChange={setFilter} options={[
        { k: 'mine', l: t.filterMine }, { k: 'all', l: t.filterAll },
      ]}/>
      <FilterRow value={carFilter} onChange={setCarFilter} options={[
        { k: 'all', l: t.filterAll },
        ...CARS.map(c => ({ k: c.short, l: c.short })),
      ]}/>

      {groups.map(g => {
        const total = g.items.reduce((s,x) => s + x.bedrag, 0);
        const liter = g.items.reduce((s,x) => s + x.liter, 0);
        return (
          <div key={g.key}>
            <div style={{
              padding: '18px 20px 6px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
                letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
              }}>— {g.label} —</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
                letterSpacing: 1,
              }}>{liter.toFixed(1)} L · {fmtMoney(total)}</div>
            </div>
            <div style={{ padding: '0 16px' }}>
              {g.items.map(f => <FuelStrip key={f.id} fuel={f} lang={lang}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════ Extra kosten ═══════════
function ExpensesPage({ lang, setLang }) {
  const t = strings[lang];
  const { me } = useRole();
  const [filter, setFilter] = React.useState('mine');
  const [carFilter, setCarFilter] = React.useState('all');

  let items = [...RECENT_EXPENSES];
  if (filter === 'mine') items = items.filter(x => x.who === me);
  if (carFilter !== 'all') items = items.filter(x => x.car === carFilter);
  items.sort((a,b) => b.date.localeCompare(a.date));
  const groups = groupByMonth(items, 'date', lang);

  return (
    <div style={{ background: paperB.paperDeep, minHeight: '100%', paddingBottom: 120 }}>
      <PageHeader title={t.extraKosten} lang={lang} setLang={setLang}/>
      <FilterRow value={filter} onChange={setFilter} options={[
        { k: 'mine', l: t.filterMine }, { k: 'all', l: t.filterAll },
      ]}/>
      <FilterRow value={carFilter} onChange={setCarFilter} options={[
        { k: 'all', l: t.filterAll },
        ...CARS.map(c => ({ k: c.short, l: c.short })),
      ]}/>

      {groups.map(g => {
        const total = g.items.reduce((s,x) => s + x.bedrag, 0);
        return (
          <div key={g.key}>
            <div style={{
              padding: '18px 20px 6px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
                letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
              }}>— {g.label} —</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
              }}>{fmtMoney(total)}</div>
            </div>
            <div style={{ padding: '0 16px' }}>
              {g.items.map(e => (
                <div key={e.id} style={{
                  background: paperB.paper, padding: '12px 14px', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderLeft: `3px solid ${paperB.amber}`,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}>
                  <CarStamp code={e.car} active size="sm"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink,
                      fontWeight: 600, lineHeight: 1.2,
                    }}>🔧 {e.kosten}</div>
                    <div style={{
                      fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
                      letterSpacing: 1, marginTop: 2,
                    }}>{e.who} · {fmtDate(e.date, lang)}</div>
                  </div>
                  <div style={{
                    fontFamily: paperB.fontMono, fontSize: 14, fontWeight: 700,
                    color: paperB.amber, whiteSpace: 'nowrap',
                  }}>{fmtMoney(e.bedrag)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════ Reservation / calendar ═══════════
function ReservePage({ lang, setLang, onNew }) {
  const { me } = useRole();
  const t = strings[lang];
  // Show a 2-week timeline per car, starting today
  const today = new Date('2026-04-21');
  const DAYS = 14;
  const days = Array.from({ length: DAYS }).map((_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });
  const iso = (d) => d.toISOString().slice(0,10);

  const resFor = (car, day) => RESERVATIONS.find(r =>
    r.car === car &&
    r.status !== 'rejected' &&
    iso(day) >= r.from && iso(day) <= r.to
  );

  // Click-to-reserve: first click sets start, second click sets end → opens sheet
  const [pick, setPick] = React.useState(null); // { car, from }

  const onCellClick = (carShort, day) => {
    if (resFor(carShort, day)) return; // occupied
    const dayIso = iso(day);
    if (!pick || pick.car !== carShort) {
      setPick({ car: carShort, from: dayIso });
      return;
    }
    // second click → range
    const from = pick.from < dayIso ? pick.from : dayIso;
    const to   = pick.from < dayIso ? dayIso : pick.from;
    setPick(null);
    onNew?.({ car: carShort, from, to });
  };
  const inSelection = (carShort, day) =>
    pick && pick.car === carShort && iso(day) === pick.from;

  // Fixed order: Jean-François → Ethel → Lewis
  const orderedCars = CARS;

  return (
    <div style={{ background: paperB.paperDeep, minHeight: '100%', paddingBottom: 120 }}>
      <PageHeader title={t.reservations} lang={lang} setLang={setLang}/>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap', padding: '12px 20px',
        fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5,
        textTransform: 'uppercase', color: paperB.inkDim,
        background: paperB.paperDeep,
      }}>
        <span>□ {t.available}</span>
        <span style={{ color: paperB.ink }}>■ {t.confirmed}</span>
        <span style={{ color: paperB.amber }}>▦ {t.pending}</span>
        <span style={{ color: paperB.accent }}>● {lang === 'nl' ? 'Klik 2 dagen om te reserveren' : 'Click 2 days to reserve'}</span>
      </div>

      {/* Per-car timeline */}
      <div style={{ padding: '0 12px' }}>
        {orderedCars.map(c => (
          <div key={c.short} style={{
            background: paperB.paper, marginBottom: 12, padding: '14px 14px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            }}>
              <CarStamp code={c.short} active/>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: paperB.fontSerif, fontSize: 18, fontWeight: 700,
                  color: paperB.ink, lineHeight: 1,
                }}>{c.name}</div>
                <div style={{
                  fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
                  letterSpacing: 1, marginTop: 3,
                }}>{c.merk} · {fmtMoney(c.prijs)}/km</div>
              </div>
            </div>

            {/* 14-day strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {days.map((d, i) => {
                const r = resFor(c.short, d);
                const isFirst = r && iso(d) === r.from;
                const isMine = r && r.who === me;
                const isPending = r && r.status === 'pending';
                const isPickStart = inSelection(c.short, d);
                // styles based on status
                let bg = paperB.paper, fg = paperB.ink, border = `1.5px solid ${paperB.paperDark}`;
                if (r) {
                  if (isPending) {
                    bg = `repeating-linear-gradient(45deg, ${paperB.paper} 0 4px, ${paperB.paperDark} 4px 6px)`;
                    fg = paperB.ink;
                    border = `1.5px dashed ${paperB.amber}`;
                  } else if (isMine) {
                    bg = paperB.blue; fg = paperB.paper; border = `1.5px solid ${paperB.ink}`;
                  } else {
                    bg = paperB.ink; fg = paperB.paper; border = `1.5px solid ${paperB.ink}`;
                  }
                }
                if (isPickStart) {
                  bg = paperB.accent; fg = paperB.paper;
                  border = `1.5px solid ${paperB.ink}`;
                }
                const clickable = !r;
                return (
                  <div key={i}
                    onClick={clickable ? () => onCellClick(c.short, d) : undefined}
                    title={r ? `${r.who} — ${r.reason}${isPending ? ' (in aanvraag)' : ''}` : (lang === 'nl' ? 'Klik om te reserveren' : 'Click to reserve')}
                    style={{
                      padding: '6px 2px', textAlign: 'center',
                      border,
                      background: bg,
                      color: fg,
                      fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 0.5,
                      minHeight: 46, position: 'relative',
                      cursor: clickable ? 'pointer' : 'default',
                    }}>
                    <div style={{ fontSize: 8, opacity: 0.8 }}>
                      {(lang === 'nl' ? DAYS_NL : DAYS_EN)[d.getDay()]}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{d.getDate()}</div>
                    {isFirst && (
                      <div style={{ fontSize: 7, marginTop: 2, opacity: 0.9 }}>
                        {r.who.slice(0,4)}
                      </div>
                    )}
                    {isFirst && isPending && (
                      <div style={{
                        position: 'absolute', top: 2, right: 2,
                        fontSize: 9, color: paperB.amber, fontWeight: 700,
                      }}>?</div>
                    )}
                    {isPickStart && (
                      <div style={{
                        position: 'absolute', top: 2, right: 3,
                        fontSize: 8, fontWeight: 700,
                      }}>●</div>
                    )}
                  </div>
                );
              })}
            </div>

            {pick && pick.car === c.short && (
              <div style={{
                marginTop: 8, padding: '6px 10px',
                background: paperB.paperDeep, border: `1.5px dashed ${paperB.accent}`,
                fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1,
                color: paperB.ink, display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: 8,
              }}>
                <span>● {lang === 'nl' ? 'Start gekozen' : 'Start picked'}: <b>{fmtDate(pick.from, lang)}</b> — {lang === 'nl' ? 'klik einddatum' : 'pick end date'}</span>
                <button onClick={() => setPick(null)} style={{
                  border: 'none', background: 'transparent',
                  fontFamily: paperB.fontMono, fontSize: 10, cursor: 'pointer',
                  color: paperB.inkDim, letterSpacing: 1, textTransform: 'uppercase',
                }}>✕</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* List of upcoming — split into pending and confirmed */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 11, color: paperB.ink,
          letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
          marginBottom: 10, padding: '0 4px',
        }}>— {t.upcoming} —</div>
        {RESERVATIONS.filter(r => r.status !== 'rejected').map(r => (
          <ResStripFull key={r.id} r={r} lang={lang}/>
        ))}
      </div>
    </div>
  );
}

// Extended reservation strip showing status
function ResStripFull({ r, lang }) {
  const t = strings[lang];
  const { me } = useRole();
  const isPending = r.status === 'pending';
  const isMine = r.who === me;
  return (
    <div style={{
      background: isPending
        ? `repeating-linear-gradient(45deg, ${paperB.paper} 0 6px, ${paperB.paperDeep} 6px 10px)`
        : paperB.paper,
      padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      borderLeft: `3px ${isMine ? 'solid' : 'dashed'} ${isPending ? paperB.amber : paperB.blue}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <CarStamp code={r.car} active size="sm"/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <div style={{
            fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink,
            fontWeight: 600, lineHeight: 1.2,
          }}>{r.reason}</div>
          {isPending && (
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 8, letterSpacing: 1.5, fontWeight: 700,
              padding: '2px 6px', textTransform: 'uppercase',
              border: `1.5px solid ${paperB.amber}`, color: paperB.amber,
            }}>{t.pendingBadge}</div>
          )}
        </div>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 1, marginTop: 2,
        }}>
          {r.who} · {fmtDate(r.from, lang)}
          {r.from !== r.to && <> → {fmtDate(r.to, lang)}</>}
        </div>
        {isPending && (
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.amber,
            letterSpacing: 1, marginTop: 3, fontStyle: 'italic',
          }}>↳ {t.waitingOwner}</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AllTripsPage, AllFuelPage, ExpensesPage, ReservePage, ResStripFull });
