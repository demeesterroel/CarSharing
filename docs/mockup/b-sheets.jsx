// Add-forms v2 — each form has its own real-world metaphor:
//   Trip        → logbook page (odometer is the hero)
//   Fuel        → pump display (amount + liters big & mono)
//   Expense     → pinned invoice/receipt
//   Reservation → ticket stub with hero date-range
//
// Shared chrome: a compact sticky top bar (× + Save) instead of tear-to-save.
// Tear-to-save is still available as a secondary gesture at the very bottom.

// ── Shared chrome ────────────────────────────────────────────────

function SheetChrome({ open, onClose, onSaved, lang, title, accent, submitLabel, disabled, children }) {
  const [torn, setTorn] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const startY = React.useRef(null);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) { setTorn(false); setDragY(0); }
  }, [open]);

  const commit = () => {
    if (disabled || torn) return;
    setTorn(true);
    setTimeout(() => { onSaved?.(); setTimeout(onClose, 420); }, 60);
  };

  const onStart = (e) => {
    if (torn || disabled) return;
    const el = scrollRef.current;
    if (el && el.scrollTop > 0) return;
    startY.current = e.clientY ?? e.touches?.[0]?.clientY;
  };
  const onMove = (e) => {
    if (startY.current == null || torn) return;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    setDragY(Math.max(0, y - startY.current));
  };
  const onEnd = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (dragY > 130) commit();
    else setDragY(0);
  };

  if (!open) return null;
  const progress = Math.min(dragY / 130, 1);
  const accentColor = accent || paperB.accent;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(26,26,26,0.42)', backdropFilter: 'blur(4px)',
      overflow: 'hidden',
    }}>
      {/* Sticky top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        height: 54, background: paperB.paper,
        borderBottom: `1.5px solid ${paperB.ink}`,
        display: 'flex', alignItems: 'center', padding: '0 10px',
        transform: torn ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.3s',
      }}>
        <button onClick={onClose} style={{
          width: 40, height: 40,
          background: 'transparent', color: paperB.ink,
          fontFamily: paperB.fontMono, fontSize: 22, fontWeight: 700,
          border: 'none', cursor: 'pointer', lineHeight: 1,
        }}>×</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 2.5,
            textTransform: 'uppercase', color: paperB.inkDim,
          }}>{title}</div>
        </div>
        <button onClick={commit} disabled={disabled} style={{
          padding: '8px 14px',
          background: disabled ? paperB.inkMute : accentColor,
          color: paperB.paper,
          fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
          letterSpacing: 2, textTransform: 'uppercase',
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          minWidth: 80,
        }}>{submitLabel}</button>
      </div>

      {/* Scrollable content with drag-to-tear */}
      <div
        ref={scrollRef}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        style={{
          position: 'absolute', top: 54, left: 0, right: 0, bottom: 0,
          overflow: 'auto',
          transform: torn ? 'translateY(115%) rotate(2deg)' : `translateY(${dragY}px)`,
          transition: torn ? 'transform 0.45s cubic-bezier(0.5,0,0.8,1)' : (dragY === 0 ? 'transform 0.22s' : 'none'),
        }}>
        {children}

        {/* Tear hint — subtle, secondary gesture */}
        <div style={{
          padding: '16px 20px 28px', textAlign: 'center',
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
          textTransform: 'uppercase',
          color: progress > 0.7 ? accentColor : paperB.inkMute,
          fontWeight: progress > 0.7 ? 700 : 500,
          opacity: dragY > 0 ? 1 : 0.55,
        }}>
          {progress > 0.85 ? (strings[lang].laatLos || '↓ Release ↓') : '≋ ' + (strings[lang].veegOmlaag || 'pull down to save') + ' ≋'}
        </div>
      </div>

      {/* Stamped confirmation */}
      {torn && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-8deg)', zIndex: 4,
          animation: 'stampDrop 0.35s ease-out',
        }}>
          <div style={{
            padding: '14px 26px', border: `3.5px solid ${accentColor}`,
            color: accentColor, fontFamily: paperB.fontMono,
            fontSize: 18, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase',
            background: 'rgba(245, 240, 230, 0.94)',
          }}>{strings[lang].bewaard}</div>
        </div>
      )}
    </div>
  );
}

// ── Compact header used by Trip / Fuel / Expense ────────────────
// Car pills on one line, driver + date below on a single row.
function CompactMeta({ car, setCar, driver, setDriver, date, setDate, lang }) {
  const t = strings[lang];
  const { caps } = useRole();
  const [driverOpen, setDriverOpen] = React.useState(false);
  const me = personByName[driver];
  const lockedDriver = !caps.pickAnyDriver;
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Car pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {CARS.map(c => {
          const sel = c.short === car;
          return (
            <button key={c.short} onClick={() => setCar(c.short)} style={{
              flex: 1, padding: '9px 6px',
              background: sel ? paperB.ink : 'transparent',
              color: sel ? paperB.paper : paperB.ink,
              border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
              fontFamily: paperB.fontMono, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 1, lineHeight: 1.1,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{c.short}</div>
              <div style={{ fontSize: 8, opacity: 0.7, letterSpacing: 0.3 }}>{c.name}</div>
            </button>
          );
        })}
      </div>

      {/* Driver + Date on one row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div
          onClick={lockedDriver ? undefined : () => setDriverOpen(v => !v)}
          style={{
            flex: 1, padding: '9px 12px', textAlign: 'left',
            background: lockedDriver ? paperB.paperDeep : paperB.paper,
            color: paperB.ink,
            border: `1.5px ${lockedDriver ? 'dashed' : 'solid'} ${paperB.ink}`,
            fontFamily: paperB.fontSerif, fontSize: 15, fontWeight: 600,
            cursor: lockedDriver ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
          <span style={{
            fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5,
            textTransform: 'uppercase', color: paperB.inkDim,
          }}>{t.bestuurder}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>
            {driver}{me?.k > 0 && <span style={{ color: paperB.accent, marginLeft: 4 }}>★</span>}
          </span>
          <span style={{ fontSize: 10, color: paperB.inkDim }}>
            {lockedDriver ? '🔒' : '▾'}
          </span>
        </div>
        <div style={{
          flex: 1, padding: '0 10px',
          background: paperB.paper,
          border: `1.5px solid ${paperB.ink}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1.5,
            textTransform: 'uppercase', color: paperB.inkDim,
          }}>{t.datum}</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
            fontFamily: paperB.fontSerif, fontSize: 15, color: paperB.ink, fontWeight: 600,
            background: 'transparent', border: 'none', padding: 0,
            outline: 'none', flex: 1, textAlign: 'right',
          }}/>
        </div>
      </div>

      {/* Driver popup */}
      {driverOpen && !lockedDriver && (
        <div style={{
          marginTop: 8, padding: 10,
          background: paperB.paperDeep, border: `1.5px dashed ${paperB.ink}`,
          animation: 'popIn 0.16s ease-out',
        }}>
          <PersonPicker value={driver} onChange={(v) => { setDriver(v); setDriverOpen(false); }}/>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
            marginTop: 6, letterSpacing: 0.5,
          }}>
            <span style={{ color: paperB.accent }}>★</span> {lang === 'nl' ? 'krijgt korting' : 'has discount'}
          </div>
        </div>
      )}
      {lockedDriver && (
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkMute,
          marginTop: 4, letterSpacing: 1,
        }}>
          🔒 {lang === 'nl' ? 'Jouw eigen naam — enkel admin kan voor anderen registreren' : 'Your name — only admins can log on behalf of others'}
        </div>
      )}
    </div>
  );
}

// ── TRIP: the logbook page ───────────────────────────────────────
// Hero: odometer start/end with the gap in the middle. Then parking + breakdown.
function TripSheet({ open, onClose, onSaved, lang }) {
  const t = strings[lang];
  const { me } = useRole();
  const [car, setCar] = React.useState('JF');
  const [driver, setDriver] = React.useState(me);
  const [date, setDate] = React.useState('2026-04-21');
  const [startKm, setStartKm] = React.useState('266357');
  const [eindKm, setEindKm] = React.useState('266485');
  const [parking, setParking] = React.useState('Antwerpen — Zurenborg');

  React.useEffect(() => {
    if (open) {
      setCar('JF'); setDriver(me); setDate('2026-04-21');
      setStartKm('266357'); setEindKm('266485');
      setParking('Antwerpen — Zurenborg');
    }
  }, [open, me]);

  const km = Math.max(0, (Number(eindKm) || 0) - (Number(startKm) || 0));
  const carObj = carByShort[car];
  const personObj = personByName[driver];
  const bd = calcTripBreakdown(km, personObj, carObj);
  const disabled = km === 0;

  return (
    <SheetChrome open={open} onClose={onClose} onSaved={onSaved} lang={lang}
      title={lang === 'nl' ? '① Rit registreren' : '① Log a trip'}
      submitLabel={t.ritOpslaan} disabled={disabled}>

      <div style={{
        background: paperB.paper, minHeight: '100%',
        padding: '18px 18px 24px',
      }}>
        <CompactMeta car={car} setCar={setCar}
          driver={driver} setDriver={setDriver}
          date={date} setDate={setDate} lang={lang}/>

        {/* Hero: odometer */}
        <div style={{
          background: paperB.paperDeep,
          border: `1.5px solid ${paperB.ink}`,
          padding: '18px 16px 20px',
          position: 'relative',
          marginBottom: 14,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2.5, textTransform: 'uppercase',
            textAlign: 'center', marginBottom: 14,
          }}>◎ {lang === 'nl' ? 'Kilometerstand' : 'Odometer'}</div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            gap: 8, alignItems: 'center',
          }}>
            <OdoField label={t.startKm} value={startKm} onChange={setStartKm}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: paperB.fontMono, fontSize: 20, color: paperB.ink, fontWeight: 700 }}>→</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 8, letterSpacing: 1.5,
                color: paperB.inkDim, textTransform: 'uppercase', marginTop: 2,
              }}>{km} km</div>
            </div>
            <OdoField label={t.eindKm} value={eindKm} onChange={setEindKm} right/>
          </div>

          {km > 500 && (
            <div style={{
              marginTop: 12, padding: '6px 10px',
              background: paperB.paper, border: `1.5px dashed ${paperB.amber}`,
              fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1,
              color: paperB.amber, textAlign: 'center', fontWeight: 700,
            }}>▲ {lang === 'nl' ? 'Lange rit — vanaf km 500 krijg je korting' : 'Long trip — discount from km 500'}</div>
          )}
        </div>

        {/* Parking */}
        <FieldBlock
          label={lang === 'nl' ? 'Waar staat de wagen nu?' : 'Where is the car parked?'}
          hint={<span>◉ <b>{t.gpsAuto}</b> · 51.200, 4.402</span>}
          hintColor={paperB.green}>
          <input value={parking} onChange={e => setParking(e.target.value)} style={fieldInputStyle}/>
        </FieldBlock>

        {/* Breakdown card */}
        <div style={{
          marginTop: 14, padding: '14px 16px 12px',
          background: paperB.paper,
          border: `1.5px dashed ${paperB.ink}`,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8,
          }}>— {t.breakdown || 'Breakdown'} —</div>

          <ReceiptRow label={t.tarief} value={`€ ${carObj.prijs.toFixed(2).replace('.', ',')} / km`}/>
          {bd.baseKm > 0 && (
            <ReceiptRow
              label={`${t.tariefBase} · ${bd.baseKm} km${personObj.k > 0 ? ` · −${(personObj.k*100)|0}%` : ''}`}
              value={fmtMoney(bd.baseCost)}
            />
          )}
          {bd.extraKm > 0 && (
            <ReceiptRow
              label={`${t.lange} · ${bd.extraKm} km${personObj.kl > 0 ? ` · −${(personObj.kl*100)|0}%` : ''}`}
              value={fmtMoney(bd.extraCost)} color={paperB.amber}
            />
          )}
          {bd.discount > 0 && (
            <ReceiptRow
              label={lang === 'nl' ? 'Totale korting' : 'Total discount'}
              value={`− ${fmtMoney(bd.discount)}`} color={paperB.green}
            />
          )}
          <Perf margin="8px 0"/>
          <ReceiptRow label={t.totaal} value={fmtMoney(bd.total)} big accent/>
        </div>
      </div>
    </SheetChrome>
  );
}

function OdoField({ label, value, onChange, right }) {
  return (
    <div style={{ textAlign: right ? 'right' : 'left' }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 8, letterSpacing: 1.5,
        textTransform: 'uppercase', color: paperB.inkDim, marginBottom: 4,
      }}>{label}</div>
      <input
        inputMode="numeric" value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: paperB.paper,
          border: `1.5px solid ${paperB.ink}`, padding: '10px 12px',
          fontFamily: paperB.fontMono, fontSize: 22, fontWeight: 700,
          color: paperB.ink, letterSpacing: 1.5,
          textAlign: right ? 'right' : 'left',
          outline: 'none',
        }}
      />
    </div>
  );
}

// ── FUEL: pump display ──────────────────────────────────────────
// Hero: amount € and liters L side-by-side, huge mono digits. "Volle tank?" follows.
function FuelSheet({ open, onClose, onSaved, lang }) {
  const t = strings[lang];
  const { me } = useRole();
  const [car, setCar] = React.useState('JF');
  const [driver, setDriver] = React.useState(me);
  const [date, setDate] = React.useState('2026-04-21');
  const [bedrag, setBedrag] = React.useState('62,21');
  const [liters, setLiters] = React.useState('31,26');
  const [station, setStation] = React.useState('Q8 — Berchem');
  const [vol, setVol] = React.useState(false);
  const [kmStand, setKmStand] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setCar('JF'); setDriver(me); setDate('2026-04-21');
      setBedrag('62,21'); setLiters('31,26'); setStation('Q8 — Berchem');
      setVol(false); setKmStand('');
    }
  }, [open, me]);

  const b = Number(bedrag.replace(',', '.')) || 0;
  const l = Number(liters.replace(',', '.')) || 0;
  const perL = l > 0 ? b / l : 0;
  const needsKm = vol && !kmStand;
  const disabled = b === 0 || l === 0 || needsKm;

  return (
    <SheetChrome open={open} onClose={onClose} onSaved={onSaved} lang={lang}
      title={lang === 'nl' ? '⛽ Tankbon' : '⛽ Fuel receipt'}
      submitLabel={t.tankOpslaan} disabled={disabled} accent={paperB.green}>

      <div style={{
        background: paperB.paper, minHeight: '100%',
        padding: '18px 18px 24px',
      }}>
        <CompactMeta car={car} setCar={setCar}
          driver={driver} setDriver={setDriver}
          date={date} setDate={setDate} lang={lang}/>

        {/* Hero: pump display */}
        <div style={{
          background: paperB.ink, color: paperB.paper,
          padding: '20px 18px 14px',
          border: `1.5px solid ${paperB.ink}`,
          position: 'relative',
          marginBottom: 14,
          boxShadow: 'inset 0 0 0 2px ' + paperB.ink + ', inset 0 0 0 4px ' + paperB.paperDark,
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 3,
            textTransform: 'uppercase', color: paperB.paperDark,
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <span>● {lang === 'nl' ? 'Pomp' : 'Pump'}</span>
            <span>{date.slice(5).replace('-', '/')}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14 }}>
            <PumpDigits label={t.bedrag} suffix="€" value={bedrag} onChange={setBedrag}/>
            <PumpDigits label={t.liters} suffix="L" value={liters} onChange={setLiters}/>
          </div>

          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: `1px dashed ${paperB.paperDark}`,
            display: 'flex', justifyContent: 'space-between',
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
            color: paperB.paperDark, textTransform: 'uppercase',
          }}>
            <span>{t.prijsL}</span>
            <span style={{ color: paperB.paper, fontWeight: 700 }}>
              {perL > 0 ? `€ ${perL.toFixed(3).replace('.', ',')}` : '— —'}
            </span>
          </div>
        </div>

        {/* Station */}
        <FieldBlock
          label={t.station}
          hint={<span>◉ <b>{t.gpsAuto}</b> · 51.199, 4.394</span>}
          hintColor={paperB.green}>
          <input value={station} onChange={e => setStation(e.target.value)} style={fieldInputStyle}/>
        </FieldBlock>

        {/* Volle tank */}
        <div onClick={() => setVol(v => !v)} style={{
          marginTop: 14, padding: '14px 14px',
          background: vol ? paperB.ink : paperB.paper,
          color: vol ? paperB.paper : paperB.ink,
          border: `1.5px ${vol ? 'solid' : 'dashed'} ${paperB.ink}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 22, height: 22,
            border: `1.5px solid ${vol ? paperB.paper : paperB.ink}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: paperB.fontMono, fontSize: 14, fontWeight: 700,
          }}>{vol ? '✓' : ''}</div>
          <div>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 11, fontWeight: 700,
              letterSpacing: 2, textTransform: 'uppercase',
            }}>{t.volleTank}</div>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 11, fontStyle: 'italic',
              opacity: 0.75, marginTop: 2,
            }}>{lang === 'nl' ? 'Nodig om verbruik te berekenen' : 'Needed to compute consumption'}</div>
          </div>
        </div>

        {vol && (
          <div style={{ marginTop: 12, animation: 'popIn 0.2s ease-out' }}>
            <FieldBlock label={t.kilostand} required>
              <input inputMode="numeric" value={kmStand} onChange={e => setKmStand(e.target.value)}
                placeholder="267500" style={fieldInputStyle}/>
            </FieldBlock>
          </div>
        )}
      </div>
    </SheetChrome>
  );
}

function PumpDigits({ label, suffix, value, onChange }) {
  return (
    <div>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 2,
        color: paperB.paperDark, textTransform: 'uppercase', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        borderBottom: `1.5px solid ${paperB.paperDark}`,
        paddingBottom: 4,
      }}>
        <input value={value} onChange={e => onChange(e.target.value)} style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: paperB.fontMono, fontSize: 30, fontWeight: 700,
          color: '#ffc061', letterSpacing: 1.5,
          width: '100%', padding: 0,
          textShadow: '0 0 8px rgba(255,192,97,0.35)',
        }}/>
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 14, color: paperB.paperDark,
          fontWeight: 700, marginLeft: 6,
        }}>{suffix}</div>
      </div>
    </div>
  );
}

// ── EXPENSE: pinned invoice ─────────────────────────────────────
// Category row of tiles, big amount input, description line.
function ExpenseSheet({ open, onClose, onSaved, lang }) {
  const t = strings[lang];
  const { me } = useRole();
  const [car, setCar] = React.useState('JF');
  const [driver, setDriver] = React.useState(me);
  const [date, setDate] = React.useState('2026-04-21');
  const [bedrag, setBedrag] = React.useState('');
  const [cat, setCat] = React.useState('maintenance');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setCar('JF'); setDriver(me); setDate('2026-04-21');
      setBedrag(''); setCat('maintenance'); setNote('');
    }
  }, [open, me]);

  const cats = [
    { k: 'maintenance', l: t.maintenance, icon: '🔧' },
    { k: 'insurance',   l: t.insurance,   icon: '🛡' },
    { k: 'tax',         l: t.tax,         icon: '📜' },
    { k: 'other',       l: t.other,       icon: '✎' },
  ];
  const b = Number((bedrag || '0').replace(',', '.'));
  const disabled = b === 0 || !note.trim();

  return (
    <SheetChrome open={open} onClose={onClose} onSaved={onSaved} lang={lang}
      title={lang === 'nl' ? '🧾 Extra kost' : '🧾 Extra cost'}
      submitLabel={t.kostOpslaan} disabled={disabled} accent={paperB.amber}>

      <div style={{
        background: paperB.paper, minHeight: '100%',
        padding: '18px 18px 24px',
      }}>
        <CompactMeta car={car} setCar={setCar}
          driver={driver} setDriver={setDriver}
          date={date} setDate={setDate} lang={lang}/>

        {/* Category tiles */}
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
          letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8,
        }}>— {t.category} —</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
          {cats.map(c => {
            const sel = c.k === cat;
            return (
              <button key={c.k} onClick={() => setCat(c.k)} style={{
                padding: '14px 4px 10px',
                background: sel ? paperB.ink : paperB.paper,
                color: sel ? paperB.paper : paperB.ink,
                border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 6,
                transform: sel ? 'rotate(-1deg)' : 'none',
                transition: 'transform 0.15s',
              }}>
                <div style={{ fontSize: 20 }}>{c.icon}</div>
                <div style={{
                  fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1,
                  textTransform: 'uppercase', fontWeight: 700,
                }}>{c.l}</div>
              </button>
            );
          })}
        </div>

        {/* Hero: big amount */}
        <div style={{
          background: paperB.paperDeep, border: `1.5px solid ${paperB.ink}`,
          padding: '18px 16px', marginBottom: 14, position: 'relative',
        }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
          }}>{t.bedrag}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 40, color: paperB.ink,
              fontWeight: 700, lineHeight: 1,
            }}>€</div>
            <input
              inputMode="decimal" value={bedrag} onChange={e => setBedrag(e.target.value)}
              placeholder="0,00"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: paperB.fontSerif, fontSize: 44, fontWeight: 700,
                color: paperB.ink, padding: 0, letterSpacing: -0.5,
              }}
            />
          </div>
        </div>

        <FieldBlock label={lang === 'nl' ? 'Omschrijving' : 'Description'} required>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder={lang === 'nl' ? 'bv. Autokeuring · € 51,30' : 'e.g. Inspection · € 51.30'}
            style={fieldInputStyle}/>
        </FieldBlock>
      </div>
    </SheetChrome>
  );
}

// ── RESERVATION: ticket stub ────────────────────────────────────
// Hero: a ticket with big date-range, days count centered,
// availability strip below shows the 10 following days. Accepts `prefill`.
function ReserveSheet({ open, onClose, onSaved, lang, prefill }) {
  const t = strings[lang];
  const { me, caps } = useRole();
  const [car, setCar] = React.useState('JF');
  const [driver, setDriver] = React.useState(me);
  const [from, setFrom] = React.useState('2026-04-24');
  const [to, setTo] = React.useState('2026-04-26');
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setCar(prefill?.car || 'JF');
      setDriver(prefill?.driver || me);
      setFrom(prefill?.from || '2026-04-24');
      setTo(prefill?.to || prefill?.from || '2026-04-26');
      setReason(prefill?.reason || '');
    }
  }, [open, prefill, me]);

  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const conflict = findConflict(car, from, to);
  const carObj = carByShort[car];

  return (
    <SheetChrome open={open} onClose={onClose} onSaved={onSaved} lang={lang}
      title={lang === 'nl' ? '🎟 Reserveren' : '🎟 Reserve'}
      submitLabel={t.reserveOpslaan}
      accent={conflict ? paperB.amber : paperB.blue}>

      <div style={{
        background: paperB.paper, minHeight: '100%',
        padding: '18px 18px 24px',
      }}>
        {/* Car pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {CARS.map(c => {
            const sel = c.short === car;
            return (
              <button key={c.short} onClick={() => setCar(c.short)} style={{
                flex: 1, padding: '9px 6px',
                background: sel ? paperB.ink : 'transparent',
                color: sel ? paperB.paper : paperB.ink,
                border: `1.5px ${sel ? 'solid' : 'dashed'} ${paperB.ink}`,
                fontFamily: paperB.fontMono, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 1, lineHeight: 1.1,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{c.short}</div>
                <div style={{ fontSize: 8, opacity: 0.7 }}>{c.name}</div>
              </button>
            );
          })}
        </div>

        {/* Driver row */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
          }}>{t.bestuurder}</div>
          {caps.pickAnyDriver ? (
            <PersonPicker value={driver} onChange={setDriver}/>
          ) : (
            <div style={{
              padding: '10px 14px', background: paperB.paperDeep,
              border: `1.5px dashed ${paperB.ink}`,
              fontFamily: paperB.fontSerif, fontSize: 16, fontWeight: 600,
              color: paperB.ink, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{driver}</span>
              <span style={{ fontSize: 10, color: paperB.inkDim, marginLeft: 'auto' }}>🔒</span>
            </div>
          )}
        </div>

        {/* Hero ticket */}
        <div style={{
          position: 'relative',
          background: paperB.paperDeep,
          border: `1.5px solid ${paperB.ink}`,
          padding: '18px 18px 14px',
          marginBottom: 12,
        }}>
          {/* Perforation on the right */}
          <div style={{
            position: 'absolute', right: 72, top: 0, bottom: 0,
            borderLeft: `1.5px dashed ${paperB.ink}`,
          }}/>
          {/* Ticket holes */}
          <div style={{
            position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 12, borderRadius: 6,
            background: paperB.paper, border: `1.5px solid ${paperB.ink}`,
          }}/>
          <div style={{
            position: 'absolute', right: -7, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 12, borderRadius: 6,
            background: paperB.paper, border: `1.5px solid ${paperB.ink}`,
          }}/>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 72px',
            gap: 14, alignItems: 'stretch',
          }}>
            <div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                letterSpacing: 2, textTransform: 'uppercase',
              }}>{carObj.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: paperB.fontMono, fontSize: 8, color: paperB.inkDim,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                  }}>{t.van}</div>
                  <input type="date" value={from} onChange={e => {
                    setFrom(e.target.value);
                    if (e.target.value > to) setTo(e.target.value);
                  }} style={{
                    fontFamily: paperB.fontSerif, fontSize: 20, color: paperB.ink, fontWeight: 700,
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: 0, width: '100%',
                  }}/>
                </div>
                <div style={{
                  fontFamily: paperB.fontMono, fontSize: 16, color: paperB.accent, fontWeight: 700,
                  paddingBottom: 4,
                }}>→</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: paperB.fontMono, fontSize: 8, color: paperB.inkDim,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                  }}>{t.tot}</div>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} style={{
                    fontFamily: paperB.fontSerif, fontSize: 20, color: paperB.ink, fontWeight: 700,
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: 0, width: '100%',
                  }}/>
                </div>
              </div>
            </div>
            {/* Days stub */}
            <div style={{
              borderLeft: `1.5px dashed ${paperB.ink}`, paddingLeft: 14,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              alignItems: 'center',
            }}>
              <div style={{
                fontFamily: paperB.fontSerif, fontSize: 28, fontWeight: 700,
                color: paperB.ink, lineHeight: 1,
              }}>{days}</div>
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
                letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2,
              }}>{days === 1 ? t.day : t.days}</div>
            </div>
          </div>
        </div>

        {/* Availability strip for the chosen car around `from` */}
        <AvailabilityStrip car={car} from={from} to={to} lang={lang}/>

        <FieldBlock label={t.reden} optional>
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder={lang === 'nl' ? 'bv. weekend kust' : 'e.g. weekend trip'}
            style={fieldInputStyle}/>
        </FieldBlock>

        {conflict ? (
          <div style={{
            marginTop: 12, padding: '12px 14px',
            background: `repeating-linear-gradient(45deg, ${paperB.paper} 0 6px, ${paperB.paperDeep} 6px 10px)`,
            border: `1.5px dashed ${paperB.amber}`,
          }}>
            <div style={{
              fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
              textTransform: 'uppercase', fontWeight: 700, color: paperB.amber,
              marginBottom: 4,
            }}>▲ {t.conflictWarn}</div>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 14, color: paperB.ink, lineHeight: 1.3,
            }}>
              <b>{conflict.who}</b> — {conflict.reason}
              <div style={{
                fontFamily: paperB.fontMono, fontSize: 10, color: paperB.inkDim,
                letterSpacing: 1, marginTop: 2,
              }}>
                {fmtDate(conflict.from, lang)}{conflict.from !== conflict.to && <> → {fmtDate(conflict.to, lang)}</>}
                {' '}· {t[conflict.status]}
              </div>
            </div>
            <div style={{
              fontFamily: paperB.fontSerif, fontSize: 11, fontStyle: 'italic',
              color: paperB.inkDim, marginTop: 6, lineHeight: 1.4,
            }}>{t.conflictSub}</div>
          </div>
        ) : (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: paperB.paper, border: `1.5px dashed ${paperB.green}`,
            fontFamily: paperB.fontMono, fontSize: 10, letterSpacing: 1.5,
            color: paperB.green, textAlign: 'center',
            textTransform: 'uppercase', fontWeight: 700,
          }}>✓ {lang === 'nl' ? 'Periode vrij — wacht op bevestiging' : 'Period free — awaiting owner'}</div>
        )}
      </div>
    </SheetChrome>
  );
}

// 14-day availability strip — compact, visual
function AvailabilityStrip({ car, from, to, lang }) {
  const fromD = new Date(from);
  // Anchor 3 days before from
  const start = new Date(fromD); start.setDate(fromD.getDate() - 3);
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
  const iso = (d) => d.toISOString().slice(0, 10);
  const resFor = (d) => RESERVATIONS.find(r =>
    r.car === car && r.status !== 'rejected' &&
    iso(d) >= r.from && iso(d) <= r.to
  );
  const inRange = (d) => iso(d) >= from && iso(d) <= to;

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
      }}>— {lang === 'nl' ? 'Beschikbaarheid' : 'Availability'} —</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 2 }}>
        {days.map((d, i) => {
          const r = resFor(d);
          const sel = inRange(d);
          let bg = paperB.paper, fg = paperB.ink;
          if (r) {
            if (r.status === 'pending') {
              bg = `repeating-linear-gradient(45deg, ${paperB.paper} 0 3px, ${paperB.paperDark} 3px 5px)`;
            } else {
              bg = paperB.ink; fg = paperB.paper;
            }
          }
          if (sel) {
            bg = paperB.blue; fg = paperB.paper;
          }
          return (
            <div key={i} style={{
              padding: '4px 0', textAlign: 'center',
              background: bg, color: fg,
              border: `1px solid ${paperB.ink}`,
              fontFamily: paperB.fontMono, fontSize: 9,
              minHeight: 32, lineHeight: 1.2,
            }}>
              <div style={{ fontSize: 7, opacity: 0.7 }}>
                {(lang === 'nl' ? DAYS_NL : DAYS_EN)[d.getDay()].slice(0,1).toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, fontSize: 11 }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared tiny bits ────────────────────────────────────────────
const fieldInputStyle = {
  width: '100%', background: paperB.paper,
  border: `1.5px solid ${paperB.ink}`, padding: '10px 12px',
  fontFamily: paperB.fontSerif, fontSize: 16, color: paperB.ink,
  fontWeight: 500, outline: 'none', boxSizing: 'border-box',
};

function FieldBlock({ label, hint, hintColor, required, optional, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: paperB.fontMono, fontSize: 9, color: paperB.inkDim,
        letterSpacing: 1.5, textTransform: 'uppercase',
        marginBottom: 4, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{label}{required && <span style={{ color: paperB.accent }}> *</span>}</span>
        {optional && <span style={{ opacity: 0.7, fontStyle: 'italic' }}>{label.includes('(') ? '' : '(optional)'}</span>}
      </div>
      {children}
      {hint && (
        <div style={{
          fontFamily: paperB.fontMono, fontSize: 9, letterSpacing: 1,
          marginTop: 3, color: hintColor || paperB.inkDim,
          textTransform: 'uppercase',
        }}>{hint}</div>
      )}
    </div>
  );
}

Object.assign(window, {
  SheetChrome, CompactMeta, TripSheet, FuelSheet, ExpenseSheet, ReserveSheet,
  AvailabilityStrip, FieldBlock,
  // legacy name kept so anything that still references it doesn't break
  TearableSheet: SheetChrome, UnifiedTop: CompactMeta,
});
